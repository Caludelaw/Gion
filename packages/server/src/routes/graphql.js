/**
 * GraphQL API Route
 *
 * REST 之外的第二个 API 通道。
 * 提供灵活的客户端自定义查询——前端想要什么字段就取什么字段。
 *
 * POST /api/graphql — GraphQL 端点
 * GET  /api/graphql — GraphiQL 交互式 IDE（开发环境）
 *
 * 支持 Bearer JWT 或 X-Gion-Agent-Key 认证。
 */

import { buildSchema, graphql } from 'graphql';
import { getStore, getHooks } from '../context.js';
import { search as vectorSearch } from '../search.js';
import { requireAuth } from '../middleware/auth.js';

// ─── Schema Definition ────────────────────────────────────

const schemaSDL = `
  type Document {
    id: ID!
    type: String!
    data: JSON
    status: String
    createdBy: String
    createdAt: String
    updatedAt: String
  }

  type ContentType {
    name: String!
    label: String!
    description: String
    schemaOrg: String
    fieldCount: Int
  }

  type SearchResult {
    id: ID!
    type: String!
    title: String
    status: String
    score: Float
    updatedAt: String
  }

  scalar JSON

  type Query {
    """获取单个文档"""
    content(type: String!, id: ID!): Document

    """列出某类型的文档"""
    contentList(
      type: String!
      status: String
      search: String
      limit: Int
      offset: Int
    ): [Document!]!

    """语义搜索"""
    search(query: String!, type: String, limit: Int): [SearchResult!]!

    """列出所有内容类型"""
    contentTypes: [ContentType!]!

    """健康检查"""
    health: String!
  }

  type Mutation {
    """创建文档"""
    createContent(type: String!, data: JSON!, status: String): Document

    """更新文档"""
    updateContent(type: String!, id: ID!, data: JSON!): Document

    """删除文档"""
    deleteContent(type: String!, id: ID!): Boolean!
  }
`;

// ─── Resolvers ────────────────────────────────────────────

const resolvers = {
  JSON: {
    serialize: (v) => v,
    parseValue: (v) => v
  },

  Query: {
    async content(_, { type, id }) {
      const store = getStore();
      return store.get(id);
    },

    async contentList(_, args) {
      const store = getStore();
      const docs = await store.list({
        type: args.type,
        status: args.status || undefined,
        search: args.search || undefined,
        limit: args.limit || 20,
        offset: args.offset || 0
      });
      return docs;
    },

    async search(_, { query, type, limit = 10 }) {
      const results = vectorSearch(query, limit);
      const store = getStore();
      const docs = [];

      for (const { docId, score } of results) {
        try {
          const doc = await store.get(docId);
          if (doc && (!type || doc.type === type)) {
            docs.push({
              id: doc.id,
              type: doc.type,
              title: doc.data?.title || doc.data?.name || '(untitled)',
              status: doc.status,
              score: Math.round(score * 100) / 100,
              updatedAt: doc.updatedAt
            });
          }
        } catch { /* skip */ }
      }

      return docs;
    },

    contentTypes() {
      // Import dynamically to avoid circular deps
      return import('./api.js').then(m => {
        const types = m.getContentTypes ? m.getContentTypes() : [];
        return types;
      }).catch(() => []);
    },

    health() {
      return `Gion CMS v0.2.0 — uptime: ${Math.floor(process.uptime())}s`;
    }
  },

  Mutation: {
    async createContent(_, { type, data, status }) {
      const store = getStore();
      const hooks = getHooks();

      let payload = { type, data, status: status || 'draft' };
      payload = await hooks.run('beforeCreate', payload, { store });
      const doc = await store.create(payload);
      await hooks.run('afterCreate', doc, { store });
      return doc;
    },

    async updateContent(_, { type, id, data }) {
      const store = getStore();
      const hooks = getHooks();

      let payload = { id, type, data };
      payload = await hooks.run('beforeUpdate', payload, { store });
      const doc = await store.update(id, payload);
      if (doc) await hooks.run('afterUpdate', doc, { store });
      return doc;
    },

    async deleteContent(_, { type, id }) {
      const store = getStore();
      const hooks = getHooks();

      let payload = { id, type };
      payload = await hooks.run('beforeDelete', payload, { store });
      const deleted = await store.delete(id);
      if (deleted) await hooks.run('afterDelete', { id, type }, { store });
      return deleted;
    }
  }
};

// ─── Build Schema ─────────────────────────────────────────

let schema = null;

function getSchema() {
  if (!schema) {
    schema = buildSchema(schemaSDL);
  }
  return schema;
}

// ─── Route Handler ────────────────────────────────────────

/**
 * @param {import('../context.js').Context} ctx
 */
export async function graphqlRoutes(ctx) {
  const s = getSchema();

  // GET: GraphiQL playground (simple HTML)
  if (ctx.req.method === 'GET') {
    ctx.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    ctx.res.end(GRAPHIQL_HTML);
    return;
  }

  // POST: Execute GraphQL query (mutations require auth)
  if (ctx.req.method === 'POST') {
    const { query, variables, operationName } = ctx.body || {};

    if (!query) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ errors: [{ message: 'Query is required' }] }));
      return;
    }

    // Require auth for mutations
    const isMutation = query.trim().toLowerCase().startsWith('mutation');
    if (isMutation) {
      const authResult = await requireAuth(ctx);
      if (!authResult.authenticated) {
        ctx.res.writeHead(authResult.status, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({ errors: [{ message: authResult.message }] }));
        return;
      }
      ctx.actor = authResult.actor;
    }

    // Validate query depth (prevent DoS via deeply nested queries)
    const maxDepth = parseInt(process.env.GION_GRAPHQL_MAX_DEPTH) || 5;
    if (estimateQueryDepth(query) > maxDepth) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ errors: [{ message: `Query depth exceeds maximum of ${maxDepth}` }] }));
      return;
    }

    try {
      const result = await graphql({
        schema: s,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: {}
      });

      ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify(result));
    } catch (err) {
      ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ errors: [{ message: err.message }] }));
    }
    return;
  }
}

/**
 * Estimate query depth to prevent deeply nested DoS attacks.
 * Simple bracket-based heuristic.
 */
function estimateQueryDepth(query) {
  let depth = 0, maxDepth = 0;
  for (const ch of query) {
    if (ch === '{') { depth++; maxDepth = Math.max(maxDepth, depth); }
    if (ch === '}') depth--;
  }
  return maxDepth;
}

// ─── GraphiQL HTML ────────────────────────────────────────

const GRAPHIQL_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Gion GraphiQL</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, sans-serif; background: #0F172A; color: #E2E8F0; height:100vh; display:flex; flex-direction:column; }
    header { padding: 12px 24px; background: #1E293B; border-bottom: 1px solid #334155; display:flex; align-items:center; gap:12px; }
    header h1 { font-size: 16px; color: #10B981; }
    header span { font-size: 12px; color: #64748B; }
    main { flex:1; display:flex; flex-direction:column; padding: 16px; gap:12px; }
    #editor { flex:1; background:#1E293B; border:1px solid #334155; border-radius:8px; padding:16px; color:#E2E8F0; font-family:'Cascadia Code',monospace; font-size:13px; resize:none; outline:none; }
    #editor:focus { border-color:#10B981; }
    .bar { display:flex; gap:8px; align-items:center; }
    button { padding: 8px 20px; background:#10B981; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; }
    button:hover { background:#059669; }
    #result { flex:1; background:#1E293B; border:1px solid #334155; border-radius:8px; padding:16px; overflow:auto; font-family:'Cascadia Code',monospace; font-size:13px; white-space:pre-wrap; }
    .error { color:#EF4444; }
    .split { display:flex; flex:1; gap:12px; }
    .split > * { flex:1; }
  </style>
</head>
<body>
<header><h1>⚡ Gion GraphiQL</h1><span>GraphQL Explorer</span></header>
<main>
  <div class="bar">
    <button onclick="run()">▶ 执行</button>
    <span style="font-size:12px;color:#64748B">Ctrl+Enter</span>
  </div>
  <div class="split">
    <textarea id="editor" placeholder="# GraphQL Query
{
  health
  contentTypes { name label }
  contentList(type:"article", limit:5) { id data status }
}">{
  health
  contentTypes {
    name
    label
    fieldCount
  }
}</textarea>
    <div id="result">点击执行查看结果</div>
  </div>
</main>
<script>
const editor=document.getElementById('editor');
const result=document.getElementById('result');

async function run() {
  try {
    const q = editor.value;
    const res = await fetch('/api/graphql', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({query:q})
    });
    const data = await res.json();
    result.innerHTML = JSON.stringify(data, null, 2);
  } catch(e) {
    result.innerHTML = '<span class="error">'+e.message+'</span>';
  }
}

editor.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') run();
});
</script>
</body>
</html>`;
