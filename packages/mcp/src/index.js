#!/usr/bin/env node

/**
 * Gion MCP Server
 *
 * 让任何支持 MCP 的 AI Agent（Claude Desktop、Super Niuma 等）
 * 直接操控 Gion CMS 的内容。
 *
 * 使用方式：
 *   node packages/mcp/src/index.js                    # stdio transport
 *   GION_API=http://localhost:3120 node ...             # 指定 API 地址
 *
 * Claude Desktop 配置示例：
 *   {
 *     "mcpServers": {
 *       "gion": {
 *         "command": "node",
 *         "args": ["packages/mcp/src/index.js"],
 *         "env": { "GION_API": "http://localhost:3120" }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const API_BASE = process.env.GION_API || 'http://localhost:3120';
const API_KEY = process.env.GION_AGENT_KEY || '';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (API_KEY) headers['X-Gion-Agent-Key'] = API_KEY;

  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Tool: list_content ───────────────────────────────────

async function listContent(args) {
  const { type, status, search, limit = 20 } = args;

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (limit) params.set('limit', String(limit));

  const data = await request(`/content/${type}?${params}`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total: data.total,
        docs: (data.docs || []).map(d => ({
          id: d.id,
          type: d.type,
          title: d.data?.title || d.data?.name || '(untitled)',
          status: d.status,
          updatedAt: d.updatedAt
        }))
      }, null, 2)
    }]
  };
}

// ─── Tool: get_content ────────────────────────────────────

async function getContent(args) {
  const { type, id } = args;
  const doc = await request(`/content/${type}/${id}`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(doc, null, 2)
    }]
  };
}

// ─── Tool: create_content ─────────────────────────────────

async function createContent(args) {
  const { type, data, status: docStatus = 'draft' } = args;
  const doc = await request(`/content/${type}`, {
    method: 'POST',
    body: JSON.stringify({ data, status: docStatus })
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ success: true, id: doc.id, type: doc.type, title: doc.data?.title }, null, 2)
    }]
  };
}

// ─── Tool: update_content ─────────────────────────────────

async function updateContent(args) {
  const { type, id, data } = args;
  const doc = await request(`/content/${type}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ data })
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ success: true, id: doc.id, updatedAt: doc.updatedAt }, null, 2)
    }]
  };
}

// ─── Tool: delete_content ─────────────────────────────────

async function deleteContent(args) {
  const { type, id } = args;
  await request(`/content/${type}/${id}`, { method: 'DELETE' });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ success: true, message: `Deleted ${type}/${id}` }, null, 2)
    }]
  };
}

// ─── Tool: list_content_types ─────────────────────────────

async function listContentTypes() {
  const data = await request('/content-types');

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data.types || data, null, 2)
    }]
  };
}

// ─── Tool: search_content ─────────────────────────────────

async function searchContent(args) {
  const { query, type } = args;
  const params = new URLSearchParams({ q: query });
  if (type) params.set('type', type);

  const data = await request(`/search?${params}`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        query: data.query,
        total: data.total,
        docs: (data.docs || []).map(d => ({
          id: d.id,
          type: d.type,
          title: d.data?.title || d.data?.name || '(untitled)',
          status: d.status,
          score: d._score,
          excerpt: d.data?.excerpt || (typeof d.data?.body === 'object' ? d.data.body?.text?.substring(0, 200) : '')
        }))
      }, null, 2)
    }]
  };
}

// ─── Server ───────────────────────────────────────────────

const server = new McpServer({
  name: 'gion',
  version: '0.2.0',
  description: 'Gion CMS — AI Agent-Native Content Infrastructure'
});

// Register tools
server.registerTool(
  'list_content',
  {
    description: 'List documents of a given content type. Use this to browse articles, pages, categories, media, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Content type name (e.g. article, page, category, media)' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'], description: 'Filter by status' },
        search: { type: 'string', description: 'Full-text search query' },
        limit: { type: 'number', description: 'Maximum results (default 20)' }
      },
      required: ['type']
    }
  },
  listContent
);

server.registerTool(
  'get_content',
  {
    description: 'Get a single document by its type and ID',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Content type name' },
        id: { type: 'string', description: 'Document ID' }
      },
      required: ['type', 'id']
    }
  },
  getContent
);

server.registerTool(
  'create_content',
  {
    description: 'Create a new document. Agent capability: you can create articles, pages, categories, or any registered content type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Content type name to create' },
        data: { type: 'object', description: 'Document data matching the content type schema' },
        status: { type: 'string', enum: ['draft', 'published'], description: 'Publication status' }
      },
      required: ['type', 'data']
    }
  },
  createContent
);

server.registerTool(
  'update_content',
  {
    description: 'Update an existing document',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Content type name' },
        id: { type: 'string', description: 'Document ID to update' },
        data: { type: 'object', description: 'Partial data to merge into the document' }
      },
      required: ['type', 'id', 'data']
    }
  },
  updateContent
);

server.registerTool(
  'delete_content',
  {
    description: 'Delete a document',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Content type name' },
        id: { type: 'string', description: 'Document ID to delete' }
      },
      required: ['type', 'id']
    }
  },
  deleteContent
);

server.registerTool(
  'list_content_types',
  {
    description: 'List all available content types and their field definitions. Use this to discover what kind of content Gion supports.',
    inputSchema: { type: 'object', properties: {} }
  },
  listContentTypes
);

server.registerTool(
  'search_content',
  {
    description: 'Semantic search across all content using TF-IDF vector similarity. Use this to find relevant documents by meaning, not just keyword matching.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query in natural language' },
        type: { type: 'string', description: 'Optional content type filter' }
      },
      required: ['query']
    }
  },
  searchContent
);

// ─── Start ────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();

  console.error(`Gion MCP Server v0.2.0`);
  console.error(`API: ${API_BASE}`);
  console.error(`Auth: ${API_KEY ? 'API Key configured' : 'none (public API)'}`);
  console.error(`Ready for agent connections via stdio`);

  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP Server fatal error:', err.message);
  process.exit(1);
});
