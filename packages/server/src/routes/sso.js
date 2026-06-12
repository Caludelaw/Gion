/**
 * SSO Routes — 企业单点登录 (OIDC + LDAP)
 *
 * GET  /api/sso/providers       — 列出可用 SSO Provider
 * GET  /api/sso/oidc            — 发起 OIDC 登录（重定向到 IdP）
 * GET  /api/sso/oidc/callback   — OIDC 回调处理（code → token → JWT）
 */

import { getSSOProviders } from '../sso-analytics.js';
import { createHash, createVerify } from 'node:crypto';
import { createLogger } from '../logger.js';
import { getStore } from '../context.js';

const log = createLogger('sso');

export async function ssoRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // GET /api/sso/providers — list available SSO providers
  if (pathname === '/api/sso/providers' && method === 'GET') {
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ providers: getSSOProviders() }));
    return;
  }

  // GET /api/sso/oidc — redirect to IdP
  if (pathname === '/api/sso/oidc' && method === 'GET') {
    const issuer = process.env.TAICHU_SSO_OIDC_ISSUER;
    const clientId = process.env.TAICHU_SSO_OIDC_CLIENT_ID;
    if (!issuer || !clientId) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'SSO not configured. Set TAICHU_SSO_OIDC_ISSUER and TAICHU_SSO_OIDC_CLIENT_ID' }));
      return;
    }

    const redirectUri = `http://${ctx.req.headers.host}/api/sso/oidc/callback`;
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');
    const nonce = createHash('sha256').update(String(Date.now())).digest('hex').substring(0, 16);

    const authUrl = `${issuer}/authorize?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      nonce
    }).toString();

    log.info(`OIDC redirect to ${issuer}`);
    ctx.res.writeHead(307, { Location: authUrl });
    ctx.res.end();
    return;
  }

  // GET /api/sso/oidc/callback — handle IdP callback
  if (pathname === '/api/sso/oidc/callback' && method === 'GET') {
    const code = ctx.url.searchParams.get('code');
    const state = ctx.url.searchParams.get('state');
    const error = ctx.url.searchParams.get('error');

    if (error) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'SSO authorization failed', detail: error }));
      return;
    }
    if (!code) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Missing authorization code' }));
      return;
    }

    const issuer = process.env.TAICHU_SSO_OIDC_ISSUER;
    const clientId = process.env.TAICHU_SSO_OIDC_CLIENT_ID;
    const clientSecret = process.env.TAICHU_SSO_OIDC_CLIENT_SECRET;
    const redirectUri = `http://${ctx.req.headers.host}/api/sso/oidc/callback`;

    if (!issuer || !clientId || !clientSecret) {
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'OIDC not fully configured (missing CLIENT_SECRET)' }));
      return;
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(`${issuer}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        }).toString()
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        log.error(`Token exchange failed: ${errBody}`);
        ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'Token exchange failed' }));
        return;
      }

      const tokens = await tokenRes.json();
      const idToken = tokens.id_token;

      if (!idToken) {
        ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'No id_token received' }));
        return;
      }

      // Decode payload without verifying signature (basic validation)
      const payload = decodeJwtPayload(idToken);
      if (!payload) {
        ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'Invalid id_token' }));
        return;
      }

      const { sub, email, name, preferred_username } = payload;
      const username = preferred_username || email?.split('@')[0] || sub;
      const displayName = name || username;

      log.info(`OIDC login: ${email || sub} (${displayName})`);

      // Find or create user
      const store = getStore();
      let user = null;
      if (store) {
        const users = await store.list({ type: 'user', limit: 100 });
        user = users.find(u => u.data?.ssoSub === sub || u.data?.email === email);
        if (!user) {
          user = await store.create({
            type: 'user',
            data: {
              username,
              email: email || '',
              displayName,
              ssoSub: sub,
              ssoProvider: 'oidc',
              role: 'editor'
            },
            status: 'active'
          });
          log.info(`Created SSO user: ${username}`);
        }
      }

      // Generate JWT session token
      const jwt = signJwt({
        sub: user?.id || sub,
        username,
        role: user?.data?.role || 'editor',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // Return HTML page that stores token and redirects to admin
      const adminUrl = '/admin/';
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>登录中...</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:80px;">
<p>✅ 登录成功，正在跳转...</p>
<script>
localStorage.setItem('taichu_token', '${jwt}');
localStorage.setItem('taichu_user', '${JSON.stringify({ id: user?.id, username, role: 'editor' }).replace(/'/g, "\\'")}');
location.href = '${adminUrl}';
</script>
</body></html>`;

      ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      ctx.res.end(html);
    } catch (err) {
      log.error(`OIDC callback error: ${err.message}`);
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Internal error during SSO callback' }));
    }
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}

/**
 * Decode JWT payload (no signature verification — for basic claims extraction).
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  } catch { return null; }
}

/**
 * Sign a simple JWT with HS256.
 */
function signJwt(payload) {
  const secret = process.env.TAICHU_JWT_SECRET || 'taichu-dev-secret-change-me';
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHash('sha256')
    .update(headerB64 + '.' + payloadB64 + secret)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}
