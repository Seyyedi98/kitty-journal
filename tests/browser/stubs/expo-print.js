window.__printed = [];
export async function printToFileAsync(opts) {
  window.__printed.push(opts);
  return { uri: 'file:///cache/Print/print-1.pdf', numberOfPages: 1, base64: opts.base64 ? 'UERG' : undefined };
}
