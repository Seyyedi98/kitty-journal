// One-shot, foreground-only location lookup. It runs ONLY when the user taps
// "use current location" in the editor. There is no background tracking.
import * as Location from "expo-location";

// Neither getCurrentPositionAsync nor reverseGeocodeAsync has a reliable
// built-in timeout: with no GPS fix, location services off, or no geocoder
// backend, they can stay pending forever and the UI sits on "Finding your
// location…". Every wait below is therefore bounded.
const FIX_TIMEOUT_MS = 15000;
const GEOCODE_TIMEOUT_MS = 6000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

async function getPosition() {
  try {
    return await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      FIX_TIMEOUT_MS,
      "getCurrentPositionAsync",
    );
  } catch (error) {
    console.warn(
      "[kitty-journal] fresh location failed, trying last known:",
      error,
    );
    // A recent cached fix is fine for "where did I write this".
    return await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }),
      3000,
      "getLastKnownPositionAsync",
    );
  }
}

/**
 * @returns {Promise<{ok:true, latitude:number, longitude:number, name:string, address:string}
 *                  |{ok:false, reason:'denied'|'unavailable'}>}
 */
export async function getCurrentPlace() {
  try {
    // The permission prompt waits on the user, so it is intentionally not timed out.
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted)
      perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: "denied" };

    // Device-level location switch off: fail fast instead of waiting for a fix.
    if (!(await Location.hasServicesEnabledAsync()))
      return { ok: false, reason: "unavailable" };

    const pos = await getPosition();
    if (!pos || !pos.coords) return { ok: false, reason: "unavailable" };
    const { latitude, longitude } = pos.coords;

    let name = "";
    let address = "";
    try {
      // Reverse geocoding needs the network (and a geocoder on the device);
      // the coordinates are kept without it.
      const [place] = await withTimeout(
        Location.reverseGeocodeAsync({ latitude, longitude }),
        GEOCODE_TIMEOUT_MS,
        "reverseGeocodeAsync",
      );
      if (place) {
        name = place.name || place.street || place.district || "";
        address = [
          place.street,
          place.city || place.subregion,
          place.region,
          place.country,
        ]
          .filter(Boolean)
          .join(", ");
      }
    } catch {
      /* offline / no geocoder: coordinates only */
    }
    return { ok: true, latitude, longitude, name, address };
  } catch (error) {
    console.warn("[kitty-journal] location failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}
