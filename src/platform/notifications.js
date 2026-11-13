// Local, on-device reminders. No server, no push token, no account.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders, normalizeReminder } from '../services/reminders';

const CHANNEL_ID = 'writing-reminders';
const TAG = 'kitty-journal-reminder';

let handlerSet = false;
export function initNotifications() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Best effort: some builds (notably Expo Go) throw from the channel module. Without our channel
// Android simply uses the default one, so the reminder must still be scheduled.
let channelReady = false;
async function ensureChannel(name) {
  if (Platform.OS !== 'android') return false;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    channelReady = true;
  } catch (e) {
    channelReady = false;
    console.warn('[kitty-journal] notification channel unavailable, using the default one:', e && e.message);
  }
  return channelReady;
}

/** @returns {Promise<'granted'|'denied'|'undetermined'>} */
export async function permissionStatus() {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain === false ? 'denied' : 'undetermined';
}

export async function requestPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.granted) return 'granted';
  return asked.canAskAgain === false ? 'denied' : 'undetermined';
}

/** Cancels only this app's reminders (identified by data.tag). */
async function cancelOurs() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.content && n.content.data && n.content.data.tag === TAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * Re-plans from scratch every time (cancel ours, schedule the plan), so editing
 * the reminder can never leave duplicates behind.
 * @param {object} reminder   { enabled, hour, minute, days }
 * @param {{title:string, messages:string[], channelName:string}} text
 * @returns {Promise<number>} how many notifications are scheduled
 */
export async function applyReminders(reminder, text) {
  await cancelOurs();
  const plan = planReminders(normalizeReminder(reminder), text.messages);
  if (!plan.length) return 0;
  await ensureChannel(text.channelName);
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: item.body, data: { tag: TAG, action: 'new-entry' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: item.weekday,
        hour: item.hour,
        minute: item.minute,
        ...(channelReady ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
  return plan.length;
}

/** Calls back when the user taps one of our reminders. Returns an unsubscribe fn. */
export function onReminderTapped(callback) {
  const handle = (response) => {
    const data = response && response.notification && response.notification.request.content.data;
    if (data && data.tag === TAG) callback();
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  // App launched cold from a tap.
  Promise.resolve(Notifications.getLastNotificationResponseAsync?.())
    .then((r) => {
      if (r) handle(r);
    })
    .catch(() => {});
  return () => sub.remove();
}

/* ------------------------- time-capsule unlocks ------------------------- */
// One one-shot notification per sealed capsule, fired at its unlock time. Re-planned from scratch like the reminders.
const CAPSULE_TAG = 'kitty-journal-capsule';

async function cancelCapsules() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.content && n.content.data && n.content.data.tag === CAPSULE_TAG) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * @param {Array<{id:number, title:string, unlock_at:string}>} capsules  still-sealed capsules (repository.listSealedCapsules)
 * @param {{title:string, body:(title:string)=>string, channelName:string}} text
 * @returns {Promise<number>} how many were scheduled
 */
export async function applyCapsuleNotifications(capsules, text) {
  await cancelCapsules();
  const future = (capsules || []).filter((c) => new Date(c.unlock_at).getTime() > Date.now() + 5000);
  if (!future.length) return 0;
  await ensureChannel(text.channelName);
  let n = 0;
  // OS limits (iOS: 64 pending) — the soonest ones matter most; the rest are re-planned on the next app start.
  for (const c of future.slice(0, 40)) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: text.title, body: text.body(c.title), data: { tag: CAPSULE_TAG, action: 'open-capsule', entryId: c.id } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(c.unlock_at),
          ...(channelReady ? { channelId: CHANNEL_ID } : {}),
        },
      });
      n += 1;
    } catch (e) {
      console.warn('[kitty-journal] capsule notification failed:', e && e.message);
    }
  }
  return n;
}

/** Calls back with the entry id when the user taps a capsule notification. Returns an unsubscribe fn. */
export function onCapsuleTapped(callback) {
  const handle = (response) => {
    const data = response && response.notification && response.notification.request.content.data;
    if (data && data.tag === CAPSULE_TAG) callback(data.entryId);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Promise.resolve(Notifications.getLastNotificationResponseAsync?.())
    .then((r) => { if (r) handle(r); })
    .catch(() => {});
  return () => sub.remove();
}
