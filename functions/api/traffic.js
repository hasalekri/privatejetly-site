// Gulf air traffic for the live map: one response covers the whole region, cached ~30 s
// so every visitor shares the same upstream requests. Also records aircraft paths in KV
// (binding name TRACKS, optional) at most every ~2 minutes, to stay inside the free KV limits.
const AREAS = [[26.0, 51.0, 250], [23.8, 56.2, 250], [23.6, 45.8, 250], [21.6, 39.6, 200]];
const SRC = [
  (a) => `https://api.adsb.lol/v2/point/${a[0]}/${a[1]}/${a[2]}`,
  (a) => `https://api.airplanes.live/v2/point/${a[0]}/${a[1]}/${a[2]}`,
];
const KEEP = ['hex', 'flight', 'r', 't', 'desc', 'ownOp', 'year', 'lat', 'lon', 'alt_baro', 'alt_geom', 'gs', 'track', 'true_heading', 'baro_rate', 'geom_rate', 'squawk', 'emergency', 'mach', 'dbFlags', 'category'];
const TTL = 30000, KEEP_MS = 3 * 3600 * 1000, GONE_MS = 20 * 60 * 1000, WRITE_GAP = 110000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let memo = null; // per-instance cache

async function getArea(a, first) {
  for (const k of [first, 1 - first]) {
    try {
      const r = await fetch(SRC[k](a), { headers: { 'User-Agent': 'privatejetly-live-map' } });
      if (!r.ok) continue;
      const j = await r.json();
      const list = j.ac || j.aircraft;
      if (Array.isArray(list)) return list;
    } catch (e) { /* try the other source */ }
  }
  return null;
}

async function collect() {
  const out = new Map(); let ok = 0;
  await Promise.all([0, 1].map(async (k) => {
    for (let i = k; i < AREAS.length; i += 2) {
      const list = await getArea(AREAS[i], k);
      if (list) {
        ok++;
        for (const p of list) {
          if (p.lat == null || p.lon == null || p.alt_baro === 'ground') continue;
          const o = {}; for (const f of KEEP) if (p[f] != null) o[f] = p[f];
          out.set(p.hex, o);
        }
      }
      if (i + 2 < AREAS.length) await wait(1100);
    }
  }));
  return { ok, ac: [...out.values()] };
}

async function record(env, ac) {
  if (!env.TRACKS) return;
  const now = Date.now();
  const all = (await env.TRACKS.get('all', 'json')) || { _t: 0, t: {} };
  if (now - (all._t || 0) < WRITE_GAP) return;
  const tracks = all.t || {};
  for (const p of ac) {
    const tr = tracks[p.hex] || (tracks[p.hex] = []);
    const last = tr[tr.length - 1];
    if (last && now - last[0] > GONE_MS) tr.length = 0;
    tr.push([now, +p.lat.toFixed(3), +p.lon.toFixed(3), typeof p.alt_baro === 'number' ? Math.round(p.alt_baro / 100) : null]);
  }
  for (const hex of Object.keys(tracks)) {
    const tr = tracks[hex].filter((q) => now - q[0] < KEEP_MS);
    if (!tr.length || now - tr[tr.length - 1][0] > GONE_MS) delete tracks[hex]; else tracks[hex] = tr;
  }
  await env.TRACKS.put('all', JSON.stringify({ _t: now, t: tracks }));
}

export async function onRequest(ctx) {
  const now = Date.now();
  const hdr = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' };
  if (memo && now - memo.t < TTL) return new Response(memo.body, { headers: hdr });
  const cache = caches.default;
  const key = new Request(new URL('/api/traffic', ctx.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const { ok, ac } = await collect();
  const body = JSON.stringify({ now, areas: ok, ac });
  if (!ok) return new Response(body, { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  memo = { t: now, body };
  const res = new Response(body, { headers: { ...hdr, 'Cache-Control': 'public, max-age=30, s-maxage=30' } });
  ctx.waitUntil(cache.put(key, res.clone()));
  ctx.waitUntil(record(ctx.env, ac).catch(() => {}));
  return res;
}
