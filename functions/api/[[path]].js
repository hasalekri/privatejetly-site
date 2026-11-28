import { prices, rates } from '../../assets/campaign/catalog.mjs';

const encoder = new TextEncoder();
const sessionCookie = '__Host-jm-session';
const oauthCookie = '__Host-jm-oauth';

function cookie(name, value, seconds) {
  return `${name}=${value}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request, name) {
  return (request.headers.get('Cookie') || '').split(/;\s*/).find(value => value.startsWith(name + '='))?.slice(name.length + 1);
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const item of cookies) headers.append('Set-Cookie', item);
  return new Response(null, { status: 303, headers });
}

function nonce() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

async function digest(token) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function account(request, db) {
  const token = readCookie(request, sessionCookie);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT email FROM sessions WHERE digest = ? AND expires > ?')
    .bind(await digest(token), Date.now()).first();
}

async function callback(request, env, url) {
  const [state, verifier, destination, language] = (readCookie(request, oauthCookie) || '').split('.');
  const anchor = destination === 'account' ? '#account' : '#order-review';
  const successLocation = destination === 'owner' ? '/owner' : (language === 'ar' ? '/?lang=ar' : '/') + anchor;
  const errorLocation = destination === 'owner' ? '/owner?account=error' : '/?account=error' + (language === 'ar' ? '&lang=ar' : '') + anchor;
  const code = url.searchParams.get('code');
  if (!code || !state || state !== url.searchParams.get('state') || !verifier) {
    return redirect(errorLocation, [cookie(oauthCookie, '', 0)]);
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + '/api/callback',
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) return redirect(errorLocation, [cookie(oauthCookie, '', 0)]);
  const tokens = await tokenResponse.json();
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  });
  if (!profileResponse.ok) return redirect(errorLocation, [cookie(oauthCookie, '', 0)]);
  const profile = await profileResponse.json();
  if (!profile.email_verified || typeof profile.email !== 'string') {
    return redirect(errorLocation, [cookie(oauthCookie, '', 0)]);
  }

  const email = profile.email.trim().toLowerCase();
  await ensureSignIns(env.PREORDER_DB);
  const token = nonce();
  const seconds = 60 * 60 * 24 * 7;
  await env.PREORDER_DB.batch([
    env.PREORDER_DB.prepare('DELETE FROM sessions WHERE expires <= ?').bind(Date.now()),
    env.PREORDER_DB.prepare('INSERT INTO sessions (digest, email, expires) VALUES (?, ?, ?)')
      .bind(await digest(token), email, Date.now() + seconds * 1000),
    env.PREORDER_DB.prepare(`
      INSERT INTO customer_signins (email) VALUES (?)
      ON CONFLICT(email) DO UPDATE SET last_seen = CURRENT_TIMESTAMP
    `).bind(email),
  ]);
  return redirect(successLocation, [cookie(oauthCookie, '', 0), cookie(sessionCookie, token, seconds)]);
}

const statuses = ['received', 'reviewing', 'closed'];

async function ensureSignIns(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_signins (
      email TEXT PRIMARY KEY,
      last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function ownerRequest(request, env, url, route) {
  const db = env.PREORDER_DB;
  const owner = env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) return json({ error: 'owner_not_configured' }, 503);
  const user = await account(request, db);
  if (!user) return json({ error: 'sign_in' }, 401);
  if (user.email !== owner) return json({ error: 'forbidden' }, 403);

  if (route === 'owner-status') {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin' }, 403);
    const data = await request.text();
    if (data.length > 1024) return json({ error: 'invalid' }, 400);
    const input = JSON.parse(data);
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.reference) || !statuses.includes(input.status)) {
      return json({ error: 'invalid' }, 400);
    }
    const result = await db.prepare(`
      INSERT INTO preorder_status (reference, status)
      SELECT reference, ? FROM preorders WHERE reference = ?
      ON CONFLICT(reference) DO UPDATE SET status = excluded.status
    `).bind(input.status, input.reference).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: 'not_found' }, 404);
  }

  if (request.method !== 'GET') return json({ error: 'method' }, 405);
  const view = url.searchParams.get('view');
  const search = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 254);
  const status = url.searchParams.get('status');
  const page = Number(url.searchParams.get('page') || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return json({ error: 'invalid' }, 400);
  const size = 50;
  if (view === 'people') {
    await ensureSignIns(db);
    const { results } = await db.prepare(`
      WITH people AS (
        SELECT email, last_seen FROM customer_signins
        UNION ALL SELECT email, datetime((expires / 1000) - 604800, 'unixepoch') FROM sessions
        UNION ALL SELECT email, NULL FROM preorders
      ), totals AS (
        SELECT email, COUNT(*) AS preorder_count FROM preorders GROUP BY email
      )
      SELECT p.email, MAX(p.last_seen) AS last_seen, COALESCE(t.preorder_count, 0) AS preorder_count
      FROM people AS p LEFT JOIN totals AS t ON p.email = t.email
      WHERE instr(p.email, ?) > 0 OR ? = ''
      GROUP BY p.email, t.preorder_count
      ORDER BY last_seen DESC, p.email LIMIT ? OFFSET ?
    `).bind(search, search, size + 1, page * size).all();
    return json({ rows: results.slice(0, size), hasNext: results.length > size });
  }

  const filter = statuses.includes(status) ? status : '';
  const { results } = await db.prepare(`
    SELECT p.reference, p.email, p.items, p.total_bhd, p.created_at,
           COALESCE(s.status, 'received') AS status
    FROM preorders AS p LEFT JOIN preorder_status AS s ON s.reference = p.reference
    WHERE (? = '' OR instr(p.email, ?) > 0 OR instr(p.reference, ?) > 0)
      AND (? = '' OR COALESCE(s.status, 'received') = ?)
    ORDER BY p.created_at DESC, p.reference LIMIT ? OFFSET ?
  `).bind(search, search, search, filter, filter, size + 1, page * size).all();
  return json({
    rows: results.slice(0, size).map(row => ({ ...row, items: JSON.parse(row.items) })),
    hasNext: results.length > size
  });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const route = url.pathname.slice('/api/'.length);
  const db = env.PREORDER_DB;
  const available = Boolean(db && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (!available) return route === 'account' ? json({ available: false }) : json({ error: 'unavailable' }, 503);
  try {
    if (['owner', 'owner-status'].includes(route)) return await ownerRequest(request, env, url, route);
    if (request.method === 'GET' && route === 'account') {
      const user = await account(request, db);
      return json({
        available: true,
        signedIn: Boolean(user),
        isOwner: Boolean(user && user.email === env.OWNER_EMAIL?.trim().toLowerCase()),
      });
    }
    if (request.method === 'GET' && route === 'preorders') {
      const user = await account(request, db);
      if (!user) return json({ error: 'sign_in' }, 401);
      const { results } = await db.prepare(`
        SELECT p.reference, p.created_at, p.items, p.total_bhd,
               COALESCE(s.status, 'received') AS status
        FROM preorders AS p
        LEFT JOIN preorder_status AS s ON s.reference = p.reference
        WHERE p.email = ? ORDER BY p.created_at DESC, p.reference LIMIT 100
      `).bind(user.email).all();
      return json({ preorders: results.map(row => ({ ...row, items: JSON.parse(row.items) })) });
    }
    if (request.method === 'GET' && route === 'login') {
      const productionAlias = url.hostname === 'www.jetmajlis.com' || url.hostname === 'jetmajlis.pages.dev' ||
        url.hostname.endsWith('.jetmajlis.pages.dev');
      if (productionAlias) return redirect('https://jetmajlis.com/api/login' + url.search);
      const state = nonce();
      const verifier = nonce();
      const digestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
      const challenge = btoa(String.fromCharCode(...digestBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const next = url.searchParams.get('next');
      const destination = ['account', 'owner'].includes(next) ? next : 'review';
      const language = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + '/api/callback',
        response_type: 'code', scope: 'openid email', state,
        code_challenge: challenge, code_challenge_method: 'S256',
      });
      if (destination === 'owner') params.set('prompt', 'select_account');
      return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params, [cookie(oauthCookie, [state, verifier, destination, language].join('.'), 600)]);
    }
    if (request.method === 'GET' && route === 'callback') return await callback(request, env, url);
    if (request.method !== 'POST' || !['logout', 'preorder'].includes(route)) return json({ error: 'not_found' }, 404);
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin' }, 403);
    if (route === 'logout') {
      const token = readCookie(request, sessionCookie);
      if (token) await db.prepare('DELETE FROM sessions WHERE digest = ?').bind(await digest(token)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(sessionCookie, '', 0) });
    }
    const user = await account(request, db);
    if (!user) return json({ error: 'sign_in' }, 401);
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({ error: 'invalid' }, 400);
    const data = await request.text();
    if (data.length > 4096) return json({ error: 'invalid' }, 400);
    const input = JSON.parse(data);
    if (!input || !/^[a-f0-9-]{36}$/i.test(input.key) || !Object.hasOwn(rates, input.currency) ||
      !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 6) return json({ error: 'invalid' }, 400);
    const seen = new Set();
    let total = 0;
    const items = [];
    for (const item of input.items) {
      if (!item || !Object.hasOwn(prices, item.id) || seen.has(item.id) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return json({ error: 'invalid' }, 400);
      seen.add(item.id);
      const unit_bhd = prices[item.id];
      total += unit_bhd * item.quantity;
      items.push({ id: item.id, quantity: item.quantity, unit_bhd });
    }
    const reference = crypto.randomUUID();
    await db.prepare('INSERT OR IGNORE INTO preorders (reference,email,request_key,items,total_bhd,display_currency) VALUES (?,?,?,?,?,?)')
      .bind(reference, user.email, input.key, JSON.stringify(items), total, input.currency).run();
    const result = await db.prepare('SELECT reference FROM preorders WHERE email = ? AND request_key = ?').bind(user.email, input.key).first();
    return json({ reference: result.reference });
  } catch (error) {
    if (error instanceof SyntaxError && ['preorder', 'owner-status'].includes(route)) return json({ error: 'invalid' }, 400);
    return route === 'callback' ? redirect('/?account=error#order-review', [cookie(oauthCookie, '', 0)]) : json({ error: 'try_again' }, 500);
  }
}
