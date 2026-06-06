/**
 * @gion/server — Gion HTTP Server
 *
 * 零外部依赖的 HTTP 服务。
 * 负责：
 *   1. 路由分发
 *   2. JSON 解析
 *   3. CORS 处理
 *   4. 静态文件服务（管理后台 SPA）
 *   5. MCP 端点（Phase 2）
 *
 * 设计原则：
 *   - 每个模块可独立测试
 *   - 错误统一捕获并序列化为 JSON
 *   - 请求上下文通过 context object 传递
 */

import { createServer } from 'node:http';
import { router } from './router.js';
import { parseBody } from './body-parser.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { createContext } from './context.js';
import { bootstrap } from './bootstrap.js';

const DEFAULT_PORT = 3120;

export async function start(config = {}) {
  const port = config.port || process.env.GION_PORT || DEFAULT_PORT;
  const host = config.host || process.env.GION_HOST || '0.0.0.0';
  const storage = config.storage || process.env.GION_STORAGE || 'memory';
  const dataDir = config.dataDir || process.env.GION_DATA_DIR || null;

  // Pre-init store so the first request doesn't pay cold-start cost
  const ctx = await createContext({ req: null, res: null, url: null, body: null, config: { storage, dataDir } });
  const storeType = ctx.store.getDbPath ? `sqlite (${ctx.store.getDbPath()})` : 'memory';

  const server = createServer(async (req, res) => {
    try {
      // 1. CORS
      corsMiddleware(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 2. Parse URL
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      // 3. Parse body (for POST/PUT/PATCH)
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        body = await parseBody(req);
      }

      // 4. Build context (reuses pre-initialized store)
      const ctx2 = await createContext({ req, res, url, body, config: { storage, dataDir } });

      // 5. Route
      await router(ctx2);

    } catch (err) {
      errorHandler(res, err);
    }
  });

  server.listen(port, host, () => {
    const startMsg = [
      '',
      '  ██████╗ ██╗ ██████╗ ███╗   ██╗',
      ' ██╔════╝ ██║██╔═══██╗████╗  ██║',
      ' ██║  ███╗██║██║   ██║██╔██╗ ██║',
      ' ██║   ██║██║██║   ██║██║╚██╗██║',
      ' ╚██████╔╝██║╚██████╔╝██║ ╚████║',
      '  ╚═════╝ ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
      '',
      `  Gion CMS v${config.version || '0.1.0'}`,
      `  AI Agent-Native Content Infrastructure`,
      `  Store:     ${storeType}`,
      '',
      `  Local:   http://localhost:${port}`,
      `  Network: http://${host}:${port}`,
      '',
      `  API:     http://localhost:${port}/api`,
      `  Health:  http://localhost:${port}/api/health`,
      '',
      `  Ready.`,
      ''
    ].join('\n');
    console.log(startMsg);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try: GION_PORT=${port + 1} npm start`);
    } else {
      console.error('Server error:', err.message);
    }
    process.exit(1);
  });

  return server;
}

// Run directly if called as main module
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  bootstrap();
  await start({});
}
