// Shared helper: forward a request to a public API (the browser can't call these sites directly).
export async function forward(ctx, base) {
  const url = new URL(ctx.request.url);
  const path = (ctx.params.path || []).join('/');
  const init = { method: ctx.request.method, headers: { 'User-Agent': 'privatejetly-live-map', 'Accept': 'application/json' } };
  if (ctx.request.method === 'POST') { init.body = await ctx.request.text(); init.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(base + path + url.search, init);
  return new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });
}
