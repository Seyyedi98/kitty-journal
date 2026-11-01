window.__shots = [];
export async function captureRef(ref, options) {
  window.__shots.push({ options, has: Boolean(ref) });
  return options && options.result === 'base64' ? 'UE5H' : 'file:///cache/ReactNative/shot-1.png';
}
