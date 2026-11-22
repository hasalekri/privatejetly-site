// temporary: can these live maps be embedded in an iframe?
export async function onRequest() {
  const sites = ['https://globe.adsb.lol/', 'https://globe.airplanes.live/', 'https://globe.adsb.fi/', 'https://globe.adsbexchange.com/', 'https://globe.theairtraffic.com/'];
  const out = await Promise.all(sites.map(async (u) => {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 jetmajlis embed check' }, signal: AbortSignal.timeout(8000) });
      return { u, status: r.status, xfo: r.headers.get('x-frame-options'), csp: (r.headers.get('content-security-policy') || '').slice(0, 160) };
    } catch (e) { return { u, error: String(e).slice(0, 60) }; }
  }));
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
