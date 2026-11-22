// Route (departure/destination airports) and flown track for one aircraft.
// /api/flight?hex=xxxxxx&cs=CALLSIGN&lat=..&lon=..
async function getJSON(url, opts = {}) {
  try {
    const r = await fetch(url, { ...opts, headers: { 'User-Agent': 'privatejetly-live-map', ...(opts.headers || {}) }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

export default async (req) => {
  const u = new URL(req.url);
  const hex = (u.searchParams.get('hex') || '').toLowerCase().replace(/[^0-9a-f~]/g, '');
  const cs = (u.searchParams.get('cs') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lat = parseFloat(u.searchParams.get('lat')), lon = parseFloat(u.searchParams.get('lon'));
  const res = { route: null, track: [] };

  if (cs) {
    const j = await getJSON('https://api.adsb.lol/api/0/routeset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planes: [{ callsign: cs, lat: isFinite(lat) ? lat : 0, lng: isFinite(lon) ? lon : 0 }] }),
    });
    const x = Array.isArray(j) ? j[0] : null;
    if (x && Array.isArray(x._airports) && x._airports.length >= 2) {
      res.route = {
        plausible: x.plausible !== false,
        airports: x._airports.map((a) => ({ code: a.iata || a.icao, icao: a.icao, name: a.name, city: a.location, lat: a.lat, lon: a.lon })),
      };
    }
  }

  if (/^[0-9a-f]{6}$/.test(hex)) {
    const dir = hex.slice(-2);
    for (const kind of ['trace_full', 'trace_recent']) {
      const t = await getJSON(`https://globe.adsb.lol/data/traces/${dir}/${kind}_${hex}.json`);
      if (t && Array.isArray(t.trace) && t.trace.length) {
        const t0 = t.timestamp || 0;
        const pts = t.trace.filter((p) => p[1] != null && p[2] != null).map((p) => ({ t: Math.round((t0 + p[0]) * 1000), lat: p[1], lon: p[2], alt: p[3] }));
        // keep only the current flight: cut at the last gap longer than 30 minutes
        let start = 0;
        for (let i = 1; i < pts.length; i++) if (pts[i].t - pts[i - 1].t > 30 * 60000) start = i;
        res.track = pts.slice(start);
        break;
      }
    }
  }

  return new Response(JSON.stringify(res), {
    headers: { 'Content-Type': 'application/json', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=30' },
  });
};

export const config = { path: '/api/flight' };
