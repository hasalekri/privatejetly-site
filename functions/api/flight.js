// Recorded path for one aircraft: /api/flight?hex=xxxxxx  (needs the TRACKS KV binding)
export async function onRequest(ctx) {
  const hex = (new URL(ctx.request.url).searchParams.get('hex') || '').toLowerCase().replace(/[^0-9a-f~]/g, '');
  let track = [];
  try {
    if (ctx.env.TRACKS) {
      const all = await ctx.env.TRACKS.get('all', 'json');
      const tr = all && all.t && all.t[hex];
      if (tr) track = tr.map((q) => ({ t: q[0], lat: q[1], lon: q[2], alt: q[3] == null ? null : q[3] * 100 }));
    }
  } catch (e) { /* storage not set up yet */ }
  return new Response(JSON.stringify({ route: null, track }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' } });
}
