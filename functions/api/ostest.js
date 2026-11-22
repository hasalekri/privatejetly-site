// temporary: can Cloudflare reach OpenSky / adsb.lol right now?
export async function onRequest() {
  const t = async (name, url) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'jetmajlis.com radar' }, signal: AbortSignal.timeout(8000) });
      const txt = await r.text();
      let n = null; try { const j = JSON.parse(txt); n = (j.states || j.ac || []).length; } catch (e) {}
      return { name, status: r.status, n, ms: Date.now() - t0, head: n == null ? txt.slice(0, 80) : undefined };
    } catch (e) { return { name, error: String(e).slice(0, 80), ms: Date.now() - t0 }; }
  };
  const out = await Promise.all([
    t('opensky', 'https://opensky-network.org/api/states/all?lamin=15&lomin=34&lamax=33&lomax=60'),
    t('adsb.lol', 'https://api.adsb.lol/v2/point/25/51/250'),
    t('adsb.fi', 'https://opendata.adsb.fi/api/v2/lat/25/lon/51/dist/250'),
  ]);
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
