// Photo attachment pipeline. Pure logic over injected dependencies
// (`fs`, `manipulate`) so it runs unchanged in the app and in Node tests.
//
// Recoverable sequence (spec 10.4) — an image is reported as attached only
// once BOTH its files exist with non-zero size AND its database row committed:
//   1. process (resize / re-encode only when needed) into the cache dir
//   2. copy into the app-private attachments dir under a fresh unique name
//   3. verify size, build the thumbnail from the stored copy, verify again
//   4. insert the attachment row
// Any failure removes the files created by THIS call. Crashes between 2 and 4
// can only leave orphan files, which cleanOrphanFiles() removes later after
// verifying nothing references them.

import {
  updateAttachmentFile,
  deleteAttachment,
  emptyTrash,
  insertAttachment,
  listAttachmentRows,
  listReferencedFiles,
  newUid,
  purgeEntry,
} from '../db/repository';

// Stored photos: longest side at most 1600 px and at most 350 KB. The encoder starts at a high quality and only
// steps down as far as needed to fit; when even the lowest quality is too big it shrinks the picture a little
// instead of squeezing quality further.
export const MAX_EDGE = 1600;
export const MAX_BYTES = 350 * 1024;
export const QUALITY_STEPS = [0.9, 0.85, 0.8, 0.75, 0.7];
export const SHRINK_EDGES = [1480, 1360, 1240]; // used only if 0.7 is still over MAX_BYTES
export const SHRINK_QUALITY = 0.78;
export const QUALITY = QUALITY_STEPS[0];
export const THUMB_EDGE = 360;
export const THUMB_QUALITY = 0.7;
export const KEEP_AS_IS_BYTES = MAX_BYTES;

// Only files that look like ours are ever deleted by the cleanup code.
export const OWN_FILE_RE = /^[a-f0-9]{16,64}(_t)?\.jpg$/;

export class PhotoError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/* A file operation lock: orphan cleanup must never run while an import or a
   restore is writing files that are not yet referenced by the database. */
let activeFileOps = 0;
export function beginFileOp() {
  activeFileOps += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeFileOps = Math.max(0, activeFileOps - 1);
    }
  };
}
export const fileOpsActive = () => activeFileOps > 0;

/** "2026:10:23 14:05:09" (EXIF) -> "2026-10-23T14:05:09", or null. */
export function parseExifDate(value) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/**
 * Decide whether an image needs re-encoding. A modest JPEG is copied
 * byte-for-byte so it is never degraded by needless re-compression.
 */
export function planImageProcessing(asset) {
  const w = Number(asset.width) || 0;
  const h = Number(asset.height) || 0;
  const longest = Math.max(w, h);
  const mime = String(asset.mimeType || '').toLowerCase();
  const isJpeg = mime === 'image/jpeg' || mime === 'image/jpg';
  const small = Number(asset.fileSize) > 0 && Number(asset.fileSize) <= KEEP_AS_IS_BYTES;
  if (isJpeg && small && longest > 0 && longest <= MAX_EDGE) {
    return { recompress: false, resize: null };
  }
  const resize = longest > MAX_EDGE ? (w >= h ? { width: MAX_EDGE } : { height: MAX_EDGE }) : null;
  return { recompress: true, resize };
}

export const attachmentUri = (fs, name) => `${fs.attachmentsDir}${name}`;

const resizeFor = (w, h, edge) => (Math.max(w, h) > edge ? (w >= h ? { width: edge } : { height: edge }) : null);

/**
 * Re-encode `uri` as a JPEG that fits MAX_BYTES, always decoding from the same source (never a copy of a copy).
 * @returns {{out:{uri,width,height}, size:number, quality:number, fits:boolean}} the best result; `fits` is false
 *          only if even the smallest attempt stayed over the limit (the smallest attempt is returned then).
 */
export async function encodeWithinLimit(deps, uri, width, height, temps = []) {
  const { fs, manipulate } = deps;
  let w = Number(width) || 0;
  let h = Number(height) || 0;
  let last = null;
  const attempt = async (edge, quality) => {
    const out = await manipulate(uri, { resize: w && h ? resizeFor(w, h, edge) : null, quality });
    temps.push(out.uri);
    if (!w || !h) {
      w = out.width;
      h = out.height;
    }
    const size = (await fs.size(out.uri)) || 0;
    last = { out, size, quality, fits: size > 0 && size <= MAX_BYTES };
    return last;
  };
  for (const q of QUALITY_STEPS) {
    if ((await attempt(MAX_EDGE, q)).fits) return last;
  }
  for (const edge of SHRINK_EDGES) {
    if ((await attempt(edge, SHRINK_QUALITY)).fits) return last;
  }
  return last;
}

async function bestEffortRemove(fs, uris) {
  for (const uri of uris) {
    try {
      await fs.remove(uri);
    } catch {
      /* best effort */
    }
  }
}

/**
 * Import one picked asset as an attachment of `entryId`.
 * @returns the inserted attachment row fields (including `id`)
 * @throws PhotoError
 */
export async function importPhoto(db, deps, entryId, asset) {
  const { fs, manipulate } = deps;
  const release = beginFileOp();
  const created = [];
  const temps = [];
  try {
    await fs.ensureDir(fs.attachmentsDir);
    const uuid = await newUid(db);
    const fileName = `${uuid}.jpg`;
    const dest = attachmentUri(fs, fileName);

    let source = asset.uri;
    let width = Number(asset.width) || null;
    let height = Number(asset.height) || null;
    const plan = planImageProcessing(asset);
    if (plan.recompress) {
      const r = await encodeWithinLimit(deps, asset.uri, width, height, temps);
      source = r.out.uri;
      width = r.out.width;
      height = r.out.height;
    }

    const free = await fs.freeBytes?.();
    if (free != null && free < 20 * 1024 * 1024) throw new PhotoError('no-space', 'Not enough free storage');

    await fs.copy(source, dest);
    created.push(dest);
    const size = await fs.size(dest);
    if (!size) throw new PhotoError('copy-failed', 'Copied image is missing or empty');

    let thumbName = null;
    if (Math.max(width || 0, height || 0) > THUMB_EDGE) {
      const thumbDest = attachmentUri(fs, `${uuid}_t.jpg`);
      const resize = (width || 0) >= (height || 0) ? { width: THUMB_EDGE } : { height: THUMB_EDGE };
      const thumb = await manipulate(dest, { resize, quality: THUMB_QUALITY });
      temps.push(thumb.uri);
      await fs.copy(thumb.uri, thumbDest);
      created.push(thumbDest);
      if (!(await fs.size(thumbDest))) throw new PhotoError('thumb-failed', 'Thumbnail is missing or empty');
      thumbName = `${uuid}_t.jpg`;
    }

    const row = {
      uuid,
      entry_id: entryId,
      file_name: fileName,
      thumb_name: thumbName,
      original_name: asset.fileName || null,
      mime_type: 'image/jpeg',
      size_bytes: size,
      width,
      height,
      captured_at: parseExifDate(asset.exif && (asset.exif.DateTimeOriginal || asset.exif.DateTime)),
      status: 'ready',
    };
    row.id = await insertAttachment(db, row);
    return row;
  } catch (error) {
    await bestEffortRemove(fs, created);
    if (error instanceof PhotoError) throw error;
    throw new PhotoError('import-failed', String(error && error.message));
  } finally {
    await bestEffortRemove(
      fs,
      temps.filter((u) => u && !String(u).startsWith(fs.attachmentsDir)),
    );
    release();
  }
}

/**
 * Import several assets; one failure never aborts the others.
 * @returns {{added: object[], failed: {asset:object, code:string}[]}}
 */
export async function importPhotos(db, deps, entryId, assets) {
  const added = [];
  const failed = [];
  for (const asset of assets) {
    try {
      added.push(await importPhoto(db, deps, entryId, asset));
    } catch (error) {
      failed.push({ asset, code: error.code || 'import-failed', message: String((error && error.message) || error) });
    }
  }
  return { added, failed };
}

/** Delete files by name; only names that look like ours are ever touched. */
export async function removeFiles(fs, names) {
  let failed = 0;
  for (const name of names) {
    if (!OWN_FILE_RE.test(name)) continue;
    try {
      await fs.remove(attachmentUri(fs, name));
    } catch {
      failed += 1; // the orphan sweep will catch it later
    }
  }
  return failed;
}

export async function removeAttachmentAndFiles(db, fs, attachmentId) {
  const files = await deleteAttachment(db, attachmentId);
  await removeFiles(fs, files);
}

export async function purgeEntryAndFiles(db, fs, entryId) {
  const files = await purgeEntry(db, entryId);
  await removeFiles(fs, files);
}

export async function emptyTrashAndFiles(db, fs) {
  const files = await emptyTrash(db);
  await removeFiles(fs, files);
}

/**
 * Remove files in the attachments dir that no database row references.
 * Refuses to run while an import/restore is in progress.
 * @returns {{skipped:boolean, removed:number}}
 */
export async function cleanOrphanFiles(db, fs) {
  if (fileOpsActive()) return { skipped: true, removed: 0 };
  const release = beginFileOp();
  try {
    const referenced = await listReferencedFiles(db);
    const names = await fs.list(fs.attachmentsDir);
    let removed = 0;
    for (const name of names) {
      if (!OWN_FILE_RE.test(name) || referenced.has(name)) continue;
      try {
        await fs.remove(attachmentUri(fs, name));
        removed += 1;
      } catch {
        /* retry next time */
      }
    }
    return { skipped: false, removed };
  } finally {
    release();
  }
}

const longestOf = (row) => Math.max(Number(row.width) || 0, Number(row.height) || 0);

/**
 * Photos already stored that are over the limits (bigger than MAX_BYTES or wider than MAX_EDGE), biggest first.
 * @returns {{total:number, candidates:{row:object,size:number}[], bytes:number}}
 */
export async function findOversizedPhotos(db, fs) {
  const rows = await listAttachmentRows(db);
  const candidates = [];
  let bytes = 0;
  for (const row of rows) {
    const size = (await fs.size(attachmentUri(fs, row.file_name))) || 0;
    if (!size) continue;
    if (size > MAX_BYTES || longestOf(row) > MAX_EDGE) {
      candidates.push({ row, size });
      bytes += size;
    }
  }
  candidates.sort((a, b) => b.size - a.size);
  return { total: rows.length, candidates, bytes };
}

/**
 * Build the reduced version of a stored photo WITHOUT changing anything, so the user can compare.
 * @returns {{original:{uri,size,width,height}, reduced:{uri,size,width,height,quality}, cleanup:()=>Promise<void>}}
 */
export async function previewReduction(deps, row) {
  const { fs } = deps;
  const uri = attachmentUri(fs, row.file_name);
  const temps = [];
  const cleanup = async () => bestEffortRemove(fs, temps.filter((u) => u && !String(u).startsWith(fs.attachmentsDir)));
  try {
    const size = (await fs.size(uri)) || 0;
    const r = await encodeWithinLimit(deps, uri, row.width, row.height, temps);
    return {
      original: { uri, size, width: row.width || null, height: row.height || null },
      reduced: { uri: r.out.uri, size: r.size, width: r.out.width, height: r.out.height, quality: r.quality },
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Replace one stored photo by a reduced copy (new file, row updated, old file removed). Never makes a file bigger.
 * @returns {{status:'reduced'|'skipped'|'missing'|'failed', before?:number, after?:number}}
 */
export async function reducePhoto(db, deps, row) {
  const { fs } = deps;
  const release = beginFileOp();
  const temps = [];
  let dest = null;
  try {
    const uri = attachmentUri(fs, row.file_name);
    const before = (await fs.size(uri)) || 0;
    if (!before) return { status: 'missing' };
    if (before <= MAX_BYTES && longestOf(row) > 0 && longestOf(row) <= MAX_EDGE) return { status: 'skipped', before, after: before };
    const r = await encodeWithinLimit(deps, uri, row.width, row.height, temps);
    if (!r.size || (r.size >= before && longestOf(row) <= MAX_EDGE)) return { status: 'skipped', before, after: before };
    const fileName = `${await newUid(db)}.jpg`;
    dest = attachmentUri(fs, fileName);
    await fs.copy(r.out.uri, dest);
    const after = (await fs.size(dest)) || 0;
    if (!after) throw new PhotoError('copy-failed', 'Copied image is missing or empty');
    await updateAttachmentFile(db, row.id, { file_name: fileName, size_bytes: after, width: r.out.width, height: r.out.height });
    dest = null; // committed
    await removeFiles(fs, [row.file_name]);
    return { status: 'reduced', before, after };
  } catch (error) {
    if (dest) await bestEffortRemove(fs, [dest]);
    return { status: 'failed', message: String((error && error.message) || error) };
  } finally {
    await bestEffortRemove(fs, temps.filter((u) => u && !String(u).startsWith(fs.attachmentsDir)));
    release();
  }
}

/** Find attachment rows whose file (or thumbnail) is missing on disk. */
export async function checkAttachments(db, fs) {
  const rows = await listAttachmentRows(db);
  const missing = [];
  let missingThumbs = 0;
  for (const row of rows) {
    if (!(await fs.exists(attachmentUri(fs, row.file_name)))) {
      missing.push({ id: row.id, entry_id: row.entry_id, file_name: row.file_name });
    } else if (row.thumb_name && !(await fs.exists(attachmentUri(fs, row.thumb_name)))) {
      missingThumbs += 1;
    }
  }
  return { total: rows.length, missing, missingThumbs };
}

/** Remove rows whose image file is gone (after the user confirmed). */
export async function removeBrokenReferences(db, fs, missing) {
  for (const m of missing) await removeAttachmentAndFiles(db, fs, m.id);
}
