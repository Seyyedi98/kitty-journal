// The login session lives in the device's secure store (Android Keystore), never in the journal database.
import * as SecureStore from 'expo-secure-store';

const KEY = 'kj.account.v2';

export async function loadSession() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.refresh && s.userId ? s : null;
  } catch {
    return null;
  }
}
export async function saveSession(session) {
  try { await SecureStore.setItemAsync(KEY, JSON.stringify(session)); return true; } catch { return false; }
}
export async function clearSession() {
  try { await SecureStore.deleteItemAsync(KEY); } catch { /* nothing to clear */ }
}
