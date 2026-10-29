// In-memory expo-notifications. Tests drive it through window.__notif*.
window.__notifPerm = 'undetermined'; // 'granted' | 'denied' | 'undetermined'
window.__scheduled = [];
window.__notifTap = null;
let nextId = 1;
const listeners = new Set();
window.__tapNotification = () => listeners.forEach((fn) => fn({ notification: { request: { content: { data: { tag: 'kitty-journal-reminder', action: 'new-entry' } } } } }));

export const AndroidImportance = { DEFAULT: 3 };
export const SchedulableTriggerInputTypes = { WEEKLY: 'weekly' };
export function setNotificationHandler() {}
export async function setNotificationChannelAsync() {}
export async function getPermissionsAsync() {
  return { granted: window.__notifPerm === 'granted', canAskAgain: window.__notifPerm !== 'denied' };
}
export async function requestPermissionsAsync() {
  if (window.__notifPerm === 'undetermined' && window.__notifAnswer) window.__notifPerm = window.__notifAnswer;
  return getPermissionsAsync();
}
export async function scheduleNotificationAsync(req) {
  const identifier = 'n' + nextId++;
  window.__scheduled.push({ identifier, content: req.content, trigger: req.trigger });
  return identifier;
}
export async function getAllScheduledNotificationsAsync() {
  return window.__scheduled.map((n) => ({ identifier: n.identifier, content: n.content, trigger: n.trigger }));
}
export async function cancelScheduledNotificationAsync(id) {
  window.__scheduled = window.__scheduled.filter((n) => n.identifier !== id);
}
export function addNotificationResponseReceivedListener(fn) {
  listeners.add(fn);
  return { remove: () => listeners.delete(fn) };
}
export async function getLastNotificationResponseAsync() { return null; }
