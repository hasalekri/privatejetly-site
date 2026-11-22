// Gulf air traffic for the live map. One request covers the whole region.
// Netlify's CDN caches the answer for a few seconds, so all visitors share one upstream fetch.
const AREAS = [[26.0, 51.0, 250], [23.8, 56.2, 250], [23.6, 45.8, 250], [21.6, 39.6, 200]];
const SRC = [
  (a) => `https://api.adsb.lol/v2/point/${a[0]}/${a[1]}/${a[2]}`,
  (a) => `https://api.airplanes.live/v2/point/${a[0]}/${a[1]}/${a[2]}`,
];
const KEEP = ['hex', 'flight', 'r', 't', 'desc', 'ownOp', 'year', 'lat', 'lon', 'alt_baro', 'alt_geom', 'gs', 'track', 'true_heading', 'baro_rate', 'geom_rate', 'squawk', 'emergency', 'mach', 'dbFlags', 'category'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const body = JSON.stringify({ now: Date.now(), areas: ok, ac: [...out.values()] });
  return new Response(body, {
    status: ok ? 200 : 502,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': ok ? 'public, durable, s-maxage=10, stale-while-revalidate=30' : 'no-store',
    },
  });
};

export const config = { path: '/api/traffic' };
