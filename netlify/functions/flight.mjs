// Full recorded path for one aircraft: /api/flight?hex=xxxxxx
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const u = new URL(req.url);
  const hex = (u.searchParams.get('hex') || '').toLowerCase().replace(/[^0-9a-f~]/g, '');
  let track = [];
  try {
    const store = getStore({ name: 'tracks', consistency: 'strong' });
    const all = (await store.get('all', { type: 'json' })) || {};
    const tr = all[hex];
    if (tr) track = tr.p.map((q) => ({ t: q[0], lat: q[1], lon: q[2], alt: q[3] }));
  } catch (e) { /* storage not ready yet */ }
  return new Response(JSON.stringify({ route: null, track }), {
    headers: { 'Content-Type': 'application/json', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=20' },
  });
};

export const config = { path: '/api/flight' };
