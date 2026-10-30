// Pure helpers for the Memories map: grouping saved places and building the
// self-contained HTML page (Leaflet + OpenStreetMap) shown inside a WebView.

export const LEAFLET_VERSION = '1.9.4';
export const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
export const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_BASE_URL = 'https://kitty-journal.invalid/';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const IMG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

/** Places closer than this belong to the same spot (GPS jitter, two rooms of one house, a garden...). */
export const CLUSTER_RADIUS_M = 150;

/** Distance in metres between two coordinates (haversine). */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Group places that are (almost) the same spot — within CLUSTER_RADIUS_M of the first place of the
 * group — so one marker stands for every entry written there, however the GPS happened to round.
 * The marker sits at the average position of its places. Places without coordinates cannot be
 * drawn; they are counted in `withoutCoords`.
 * @param {Array} places rows from listLocations (newest first)
 */
export function groupPlaces(places) {
  const groups = [];
  let withoutCoords = 0;
  for (const p of places || []) {
    if (!isNum(p.latitude) || !isNum(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180) {
      withoutCoords += 1;
      continue;
    }
    // Nearest existing group whose first place is within the radius.
    let best = null;
    let bestD = Infinity;
    for (const g of groups) {
      const d = distanceMeters(g.anchorLat, g.anchorLng, p.latitude, p.longitude);
      if (d <= CLUSTER_RADIUS_M && d < bestD) {
        best = g;
        bestD = d;
      }
    }
    if (!best) {
      best = {
        key: `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`,
        anchorLat: p.latitude,
        anchorLng: p.longitude,
        latitude: p.latitude,
        longitude: p.longitude,
        name: p.name || p.address || '',
        entries: [],
        sumLat: 0,
        sumLng: 0,
      };
      groups.push(best);
    }
    best.sumLat += p.latitude;
    best.sumLng += p.longitude;
    best.entries.push({ location_id: p.id, entry_id: p.entry_id, title: p.entry_title || '', journal_date: p.journal_date, placeName: p.name || '' });
    best.latitude = best.sumLat / best.entries.length;
    best.longitude = best.sumLng / best.entries.length;
    if (!best.name) best.name = p.name || p.address || '';
  }
  return {
    groups: groups.map(({ anchorLat, anchorLng, sumLat, sumLng, ...g }) => g),
    withoutCoords,
  };
}

/** `<` is escaped so data can never close the surrounding <script>. */
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, '');

/**
 * @param {{groups: Array, images: Record<string,string>, background?: string, accent?: string, offlineText?: string}} o
 */
export function buildMapHtml({ groups, images = {}, background = '#EDEAE0', accent = '#778B6D', offlineText = '' }) {
  const bg = COLOR_RE.test(background) ? background : '#EDEAE0';
  const ac = COLOR_RE.test(accent) ? accent : '#778B6D';
  const points = groups
    .filter((g) => isNum(g.latitude) && isNum(g.longitude))
    .map((g) => ({
      key: String(g.key),
      lat: g.latitude,
      lng: g.longitude,
      n: Math.max(1, Math.floor(g.entries.length)),
      img: typeof images[g.key] === 'string' && IMG_RE.test(images[g.key]) ? images[g.key] : null,
    }));
  const offline = String(offlineText).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<link rel="stylesheet" href="${LEAFLET_CSS}">
<style>
html,body,#map{margin:0;height:100%;background:${bg};}
.leaflet-control-attribution{font:9px/1.4 sans-serif !important;background:rgba(255,255,255,.55) !important;color:#555 !important;padding:0 4px !important;}
.leaflet-control-attribution a{color:inherit !important;pointer-events:none;}
.pm{position:relative;width:48px;height:48px;}
.pm img{width:44px;height:44px;object-fit:cover;border:3px solid #fff;border-radius:13px;box-shadow:0 2px 7px rgba(0,0,0,.4);background:#d9d4c7;display:block;}
.pm .dot{width:38px;height:38px;margin:5px;border-radius:50% 50% 50% 8%;transform:rotate(-45deg);background:${ac};border:3px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.4);box-sizing:border-box;}
.pm .badge{position:absolute;right:-4px;top:-6px;min-width:18px;height:18px;border-radius:9px;background:${ac};color:#fff;font:700 11px/18px sans-serif;text-align:center;padding:0 4px;box-sizing:border-box;border:2px solid #fff;}
#off{display:none;position:absolute;inset:0;align-items:center;justify-content:center;padding:24px;text-align:center;font:13px/1.6 sans-serif;color:#6b655a;}
</style></head><body>
<div id="map"></div><div id="off">${offline}</div>
<script src="${LEAFLET_JS}"></script>
<script>
(function () {
  var pts = ${safeJson(points)};
  function post(o) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  if (!window.L) { var off = document.getElementById('off'); off.style.display = 'flex'; post({ type: 'offline' }); return; }
  var map = L.map('map', { attributionControl: false, zoomControl: true, worldCopyJump: true });
  L.tileLayer(${safeJson(TILE_URL)}, { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  if (L.control && L.control.attribution) L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
  var bounds = [];
  pts.forEach(function (p) {
    var inner = p.img ? '<img alt="" src="' + p.img + '">' : '<div class="dot"></div>';
    var badge = p.n > 1 ? '<span class="badge">' + p.n + '</span>' : '';
    var icon = L.divIcon({ className: '', html: '<div class="pm">' + inner + badge + '</div>', iconSize: [48, 48], iconAnchor: [24, 24] });
    L.marker([p.lat, p.lng], { icon: icon }).addTo(map).on('click', function () { post({ type: 'select', key: p.key }); });
    bounds.push([p.lat, p.lng]);
  });
  if (bounds.length === 1) map.setView(bounds[0], 14);
  else if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  else map.setView([20, 0], 2);
  map.on('click', function () { post({ type: 'deselect' }); });
  post({ type: 'ready' });
})();
</script></body></html>`;
}
