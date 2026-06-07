/**
 * SSO Routes — 企业单点登录
 */

import { getSSOProviders } from '../sso-analytics.js';

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
    const clientId = process.env.GION_SSO_OIDC_CLIENT_ID;
    if (!clientId) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'SSO not configured' }));
      return;
    }
    // In production, this would redirect to the IdP authorize endpoint
    ctx.res.writeHead(307, { Location: `${process.env.GION_SSO_OIDC_ISSUER}/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(`http://${ctx.req.headers.host}/api/sso/oidc/callback`)}&response_type=code&scope=openid%20profile%20email` });
    ctx.res.end();
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
