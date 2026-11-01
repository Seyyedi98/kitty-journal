// Turning one entry into a shareable file: PDF (expo-print) or a picture of the screen (view-shot).
import * as Print from 'expo-print';
import { captureRef } from 'react-native-view-shot';
import { fs } from './fs';
import { shareFile } from './share';
import { canSaveToDevice, saveFileToDevice } from './saveToDevice';

export { canSaveToDevice };

// ASCII only: Android's share FileProvider rejects file names with non-Latin letters ("Not allowed to read file under given URL").
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const fileBase = (title, dateKey) => ['kitty', String(dateKey || '').replace(/[^0-9-]/g, ''), slug(title)].filter(Boolean).join('-');

/**
 * Writes base64 data into our own cache file. The files Print / view-shot create live in
 * folders that expo-file-system (and the share provider) may refuse to read ("isn't readable"),
 * so we take the data as base64 and write the file ourselves.
 */
async function ownFile(base64, base, ext, mimeType) {
  const name = `${base}.${ext}`;
  const uri = `${fs.cacheDir}${name}`;
  await fs.remove(uri).catch(() => {});
  await fs.writeBase64(uri, base64);
  return { uri, name, mimeType };
}

/** Builds the PDF / PNG file. @returns {{uri:string, name:string, mimeType:string}} */
export async function makePdfFile(html, { title, dateKey }) {
  const res = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
  if (!res.base64) throw new Error('print returned no data');
  return ownFile(res.base64, fileBase(title, dateKey), 'pdf', 'application/pdf');
}

export async function makeImageFile(viewRef, { title, dateKey }) {
  const base64 = await captureRef(viewRef, { format: 'png', quality: 1, result: 'base64' });
  return ownFile(String(base64).replace(/^data:image\/\w+;base64,/, ''), fileBase(title, dateKey), 'png', 'image/png');
}

/**
 * Hands a made file to the user: the system share sheet, or a folder they pick (Downloads etc).
 * @returns {{done:true}|{done:false, reason:string}}
 */
export async function deliverFile(file, mode, dialogTitle) {
  if (mode === 'save') {
    const r = await saveFileToDevice(file.uri, { name: file.name, mimeType: file.mimeType });
    return r.saved ? { done: true } : { done: false, reason: r.reason };
  }
  const r = await shareFile(file.uri, { mimeType: file.mimeType, dialogTitle });
  return r.shared ? { done: true } : { done: false, reason: r.reason };
}

/** Photos as data: URIs so the PDF is self-contained. Missing files are skipped. */
export async function photoDataUris(names) {
  const out = [];
  for (const name of names) {
    try {
      out.push(`data:image/jpeg;base64,${await fs.readBase64(`${fs.attachmentsDir}${name}`)}`);
    } catch {
      /* skip a missing photo */
    }
  }
  return out;
}
