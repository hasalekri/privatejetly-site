// Gulf air traffic for the live map. One request covers the whole region.
// It also records each aircraft's path (only while someone has the map open), for /api/flight.
import { getStore } from '@netlify/blobs';
// Netlify's CDN caches the answer for a few seconds, so all visitors share one upstream fetch.
const AREAS = [[26.0, 51.0, 250], [23.8, 56.2, 250], [23.6, 45.8, 250], [21.6, 39.6, 200]];
const SRC = [
  (a) => `https://api.adsb.lol/v2/point/${a[0]}/${a[1]}/${a[2]}`,
  (a) => `https://api.airplanes.live/v2/point/${a[0]}/${a[1]}/${a[2]}`,
];
const KEEP = ['hex', 'flight', 'r', 't', 'desc', 'ownOp', 'year', 'lat', 'lon', 'alt_baro', 'alt_geom', 'gs', 'track', 'true_heading', 'baro_rate', 'geom_rate', 'squawk', 'emergency', 'mach', 'dbFlags', 'category'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const KEEP_MS = 4 * 3600 * 1000, GONE_MS = 20 * 60 * 1000, MIN_GAP = 25000;
function merge(tracks, seen, now) {
  for (const p of seen) {
    const tr = tracks[p.hex] || (tracks[p.hex] = { f: '', p: [] });
    if (p.flight) tr.f = String(p.flight).trim();
    const last = tr.p[tr.p.length - 1];
    if (last && now - last[0] > GONE_MS) tr.p = [];
    if (last && now - last[0] < MIN_GAP) continue;
    tr.p.push([now, +p.lat.toFixed(4), +p.lon.toFixed(4), typeof p.alt_baro === 'number' ? Math.round(p.alt_baro) : null]);
  }
  for (const hex of Object.keys(tracks)) {
    const tr = tracks[hex];
    tr.p = tr.p.filter((q) => now - q[0] < KEEP_MS);
    if (!tr.p.length || now - tr.p[tr.p.length - 1][0] > GONE_MS) delete tracks[hex];
  }
}

async function getArea(a, first) {
  for (const k of [first, 1 - first]) {
    try {
      const r = await fetch(SRC[k](a), { headers: { 'User-Agent': 'privatejetly-live-map' }, signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const j = await r.json();
      const list = j.ac || j.aircraft;
      if (Array.isArray(list)) return list;
    } catch (e) { /* try the other source */ }
  }
  return null;
}

export default async () => {
  const out = new Map();
  let ok = 0;
  // two areas per source, the two sources in parallel, a short pause between calls to the same source
  const lanes = [0, 1].map(async (k) => {
    for (let i = k; i < AREAS.length; i += 2) {
      const list = await getArea(AREAS[i], k);
      if (list) {
        ok++;
        for (const p of list) {
          if (p.lat == null || p.lon == null || p.alt_baro === 'ground') continue;
          const o = {};
          for (const f of KEEP) if (p[f] != null) o[f] = p[f];
          out.set(p.hex, o);
        }
      }
      await wait(1100);
    }
  });
  await Promise.all(lanes);
  if (out.size) {
    try {
      const store = getStore({ name: 'tracks', consistency: 'strong' });
      const tracks = (await store.get('all', { type: 'json' })) || {};
      merge(tracks, out.values(), Date.now());
      await store.setJSON('all', tracks);
    } catch (e) { /* recording is best effort */ }
  }
  const body = JSON.stringify({ now: Date.now(), areas: ok, ac: [...out.values()] });
  return new Response(body, {
    status: ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': ok ? 'public, durable, s-maxage=30, stale-while-revalidate=60' : 'no-store',
    },
  });
};

export const config = { path: '/api/traffic' };
