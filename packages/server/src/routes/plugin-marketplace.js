/**
 * Plugin Marketplace Routes
 *
 * GET  /api/plugins                    — list installed plugins
 * GET  /api/plugins/marketplace        — search/browse marketplace
 * POST /api/plugins/install            — install a plugin from marketplace
 * POST /api/plugins/uninstall/:name    — uninstall a plugin
 * POST /api/plugins/refresh            — refresh marketplace index
 */

import { requireAuth } from '../middleware/auth.js';
import { installPlugin, uninstallPlugin, listInstalled, isInstalled } from '../plugin-installer.js';
import { getPluginManager } from '../plugin-manager.js';

/** Default marketplace index URL */
const DEFAULT_MARKETPLACE_URL = 'https://raw.githubusercontent.com/Caludelaw/Taichu/main/marketplace.json';
const MARKETPLACE_URL = process.env.TAICHU_MARKETPLACE_URL || DEFAULT_MARKETPLACE_URL;

let _marketplaceCache = null;
let _marketplaceCacheTime = 0;
const CACHE_TTL = 300000; // 5 min

/**
 * Fetch marketplace index (with cache).
 */
async function fetchMarketplace(opts = {}) {
  const force = opts.force || false;
  if (!force && _marketplaceCache && (Date.now() - _marketplaceCacheTime) < CACHE_TTL) {
    return _marketplaceCache;
  }

  try {
    const res = await fetch(MARKETPLACE_URL);
    if (!res.ok) throw new Error(`Marketplace fetch failed: ${res.status}`);
    _marketplaceCache = await res.json();
    _marketplaceCacheTime = Date.now();
    return _marketplaceCache;
  } catch (err) {
    // Return cached if available, otherwise empty
    if (_marketplaceCache) return _marketplaceCache;
    return { version: 1, plugins: [], error: err.message };
  }
}

/** @param {import('../context.js').Context} ctx */
export async function pluginMarketplaceRoutes(ctx) {
  const { pathname } = ctx.url;
  const method = ctx.req.method;

  // Auth required for all plugin management
  const authResult = await requireAuth(ctx);
  if (!authResult.authenticated) {
    ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: authResult.error, message: authResult.message }));
    return;
  }

  // GET /api/plugins — list installed
  if (pathname === '/api/plugins' && method === 'GET') {
    const pm = getPluginManager();
    const installed = listInstalled();
    const loaded = pm.list();
    const result = installed.map(p => ({
      ...p,
      loaded: loaded.some(l => l.name === p.name)
    }));
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ plugins: result, total: result.length }));
    return;
  }

  // GET /api/plugins/marketplace — browse marketplace
  if (pathname === '/api/plugins/marketplace' && method === 'GET') {
    const search = ctx.url.searchParams.get('search')?.toLowerCase();
    const category = ctx.url.searchParams.get('category');

    const marketplace = await fetchMarketplace();
    let results = marketplace.plugins || [];

    if (search) {
      results = results.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        (p.keywords || []).some(k => k.toLowerCase().includes(search))
      );
    }
    if (category) {
      results = results.filter(p => p.category === category);
    }

    // Add install status
    const enriched = results.map(p => ({
      ...p,
      installed: isInstalled(p.name)
    }));

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      plugins: enriched,
      total: enriched.length,
      lastUpdated: marketplace.lastUpdated || null,
      source: MARKETPLACE_URL
    }));
    return;
  }

  // POST /api/plugins/install — install from marketplace
  if (pathname === '/api/plugins/install' && method === 'POST') {
    const { repo, name } = ctx.body || {};

    if (!repo && !name) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Either "repo" (GitHub repo) or "name" (marketplace plugin name) is required' }));
      return;
    }

    let installRepo = repo;
    if (!installRepo) {
      // Look up in marketplace
      const marketplace = await fetchMarketplace();
      const plugin = (marketplace.plugins || []).find(p => p.name === name);
      if (!plugin) {
        ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Plugin "${name}" not found in marketplace` }));
        return;
      }
      installRepo = plugin.repository?.replace('https://github.com/', '') || plugin.repo;
      if (!installRepo) {
        ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: `Plugin "${name}" has no repository URL` }));
        return;
      }
    }

    const result = await installPlugin(installRepo, { version: ctx.body.version });
    if (result.success) {
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    } else {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    }
    return;
  }

  // POST /api/plugins/uninstall/:name
  const uninstallMatch = pathname.match(/^\/api\/plugins\/uninstall\/(.+)$/);
  if (uninstallMatch && method === 'POST') {
    const name = uninstallMatch[1];
    const result = await uninstallPlugin(name);
    if (result.success) {
      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    } else {
      ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    }
    return;
  }

  // POST /api/plugins/refresh — refresh marketplace cache
  if (pathname === '/api/plugins/refresh' && method === 'POST') {
    const marketplace = await fetchMarketplace({ force: true });
    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ refreshed: true, pluginCount: (marketplace.plugins || []).length }));
    return;
  }

  ctx.res.writeHead(404, { 'Content-Type': 'application/json' });
  ctx.res.end(JSON.stringify({ error: 'NOT_FOUND' }));
}
