// Runs every minute on Netlify (no visitors needed). Records every aircraft's position over the Gulf
// so the live map can show each plane's full path since it entered our coverage.
import { getStore } from '@netlify/blobs';

const AREAS = [[26.0, 51.0, 250], [23.8, 56.2, 250], [23.6, 45.8, 250], [21.6, 39.6, 200]];
const SRC = [
  (a) => `https://api.adsb.lol/v2/point/${a[0]}/${a[1]}/${a[2]}`,
  (a) => `https://api.airplanes.live/v2/point/${a[0]}/${a[1]}/${a[2]}`,
];
const KEEP_MS = 4 * 3600 * 1000;    // keep up to 4 hours of path per aircraft
const GONE_MS = 20 * 60 * 1000;      // forget an aircraft 20 minutes after we last saw it
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getArea(a, first) {
  for (const k of [first, 1 - first]) {
    try {
      const r = await fetch(SRC[k](a), { headers: { 'User-Agent': 'privatejetly-live-map' }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) continue;
      const j = await r.json();
      const list = j.ac || j.aircraft;
      if (Array.isArray(list)) return list;
    } catch (e) { /* try the other source */ }
  }
  return null;
}

export async function collect() {
  const seen = new Map();
  await Promise.all([0, 1].map(async (k) => {
    for (let i = k; i < AREAS.length; i += 2) {
      const list = await getArea(AREAS[i], k);
      if (list) for (const p of list) {
        if (p.lat == null || p.lon == null || p.alt_baro === 'ground') continue;
        seen.set(p.hex, p);
      }
      await wait(1500);
    }
  }));
  return seen;
}

// tracks: { hex: { f: callsign, p: [[t, lat, lon, alt], ...] } }
export function merge(tracks, seen, now) {
  for (const [hex, p] of seen) {
    const tr = tracks[hex] || (tracks[hex] = { f: '', p: [] });
    if (p.flight) tr.f = String(p.flight).trim();
    const last = tr.p[tr.p.length - 1];
    if (last && now - last[0] > GONE_MS) tr.p = [];          // a new flight after a long gap
    const pt = [now, +p.lat.toFixed(4), +p.lon.toFixed(4), typeof p.alt_baro === 'number' ? Math.round(p.alt_baro) : null];
    if (!last || last[1] !== pt[1] || last[2] !== pt[2]) tr.p.push(pt);
  }
  for (const hex of Object.keys(tracks)) {
    const tr = tracks[hex];
    tr.p = tr.p.filter((q) => now - q[0] < KEEP_MS);
    if (!tr.p.length || now - tr.p[tr.p.length - 1][0] > GONE_MS) delete tracks[hex];
  }
  return tracks;
}

export default async () => {
  const store = getStore({ name: 'tracks', consistency: 'strong' });
  const seen = await collect();
  if (!seen.size) return new Response('no data', { status: 502 });
  const tracks = (await store.get('all', { type: 'json' })) || {};
  merge(tracks, seen, Date.now());
  await store.setJSON('all', tracks);
  return new Response(`ok ${seen.size} aircraft, ${Object.keys(tracks).length} tracks`);
};

export const config = { schedule: '* * * * *' };
