// Keeps the scheduled notifications in line with the saved reminder setting
// (e.g. after a language change, so the messages are in the right language).
import { loadSettings } from '../db/repository';
import { normalizeReminder } from './reminders';
import { applyReminders, permissionStatus } from '../platform/notifications';

export const reminderText = (t) => ({
  title: t.reminderNotifTitle,
  channelName: t.reminderChannel,
  messages: [t.reminderMsg1, t.reminderMsg2, t.reminderMsg3, t.reminderMsg4],
});

/** Best effort and silent: never throws, never asks for permission. */
export async function syncReminders(db, t) {
  try {
    const saved = await loadSettings(db);
    const reminder = normalizeReminder(saved.reminder);
    if (!reminder.enabled) return;
    if ((await permissionStatus()) !== 'granted') return;
    await applyReminders(reminder, reminderText(t));
  } catch (e) {
    console.warn('[kitty-journal] reminder sync failed:', e);
  }
}
