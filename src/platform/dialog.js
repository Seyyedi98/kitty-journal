// In-app replacement for Alert.alert: same call shape, rendered by <DialogHost /> as a popup.
let listener = null;
const queue = [];

export const Dialog = {
  /** alert(title, message, buttons?) — buttons: [{ text, style: 'cancel'|'destructive'|undefined, onPress }] */
  alert(title, message, buttons) {
    const req = { title, message, buttons: buttons && buttons.length ? buttons : [{ text: null, style: 'default' }] };
    if (listener) listener(req);
    else queue.push(req);
  },
};

export function subscribeDialog(fn) {
  listener = fn;
  while (queue.length && listener) listener(queue.shift());
  return () => {
    if (listener === fn) listener = null;
  };
}
