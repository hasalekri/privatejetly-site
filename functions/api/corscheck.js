// Diagnostic: does each data source allow browsers on other sites to read it (CORS)?
export async function onRequest() {
  const tests = {
    'adsb.lol': 'https://api.adsb.lol/v2/point/26/51/50',
    'adsb.fi': 'https://opendata.adsb.fi/api/v2/lat/26/lon/51/dist/50',
    'adsb.one': 'https://api.adsb.one/v2/point/26/51/50',
    'opensky': 'https://opensky-network.org/api/states/all?lamin=25&lomin=50&lamax=27&lomax=52',
  };
  const out = {};
  for (const [k, u] of Object.entries(tests)) {
    try {
      const r = await fetch(u, { headers: { Origin: 'https://jetmajlis.com', 'User-Agent': 'jetmajlis-cors-check' } });
      out[k] = { status: r.status, allowOrigin: r.headers.get('access-control-allow-origin'), body: (await r.text()).slice(0, 60) };
    } catch (e) { out[k] = { error: String(e).slice(0, 80) }; }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
