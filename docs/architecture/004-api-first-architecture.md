# ADR 004: API-First Architecture with MCP

- **Status:** Accepted
- **Date:** 2026-06-06
- **Author:** Liu Huai'an

## Context

Taichu must serve three distinct consumers:
1. **Human authors** — via admin SPA (browser)
2. **Human readers** — via public frontend (browser, RSS)
3. **AI agents** — via programmatic API and MCP protocol

A traditional CMS renders HTML server-side and adds a REST API as an afterthought. Taichu must invert this: API is primary, rendering is secondary.

## Decision Drivers

1. **Agent discoverability** — agents should auto-discover Taichu's capabilities
2. **Multi-channel output** — same content serves web, mobile, RSS, and agents
3. **Protocol evolution** — API design should accommodate future protocols
4. **Admin SPA** — the management interface is a client of the API, not server-rendered

## Decision

**Taichu is API-first with three API channels: REST, GraphQL, and MCP.**

```
Human Author ──→ Admin SPA ──→ REST API ──┐
                                           │
Human Reader ──→ Public Site ←── GraphQL ──┤
                                           │
AI Agent    ──→ MCP Client ──→ MCP API ───┘
```

### REST API (Phase 1)

Standard CRUD endpoints for content management:
- `GET /api/content/:type` — list documents
- `POST /api/content/:type` — create document
- `GET /api/content/:type/:id` — get document
- `PUT /api/content/:type/:id` — update document
- `DELETE /api/content/:type/:id` — delete document

### GraphQL (Phase 2)

Flexible queries for frontend consumers who need to shape responses.

### MCP Server (Phase 2)

Implements the [Model Context Protocol](https://modelcontextprotocol.io/), allowing AI agents to:
- Discover Taichu's content types and capabilities
- Read, create, and update content through standardized tool calls
- Subscribe to content change notifications

## Why Three Channels?

| Concern | REST | GraphQL | MCP |
|---------|------|---------|-----|
| Simplicity | High | Medium | Low (for humans) |
| Client control | Low | High | N/A (agent-driven) |
| Agent discoverability | None | Needs GraphQL introspection | Built-in |
| Caching | HTTP native | Complex | N/A |
| Use case | Admin CRUD, webhooks | Public frontend, mobile | Agent integration |

## MCP Integration Design

```json
{
  "name": "taichu",
  "tools": [
    {
      "name": "list_content",
      "description": "List documents of a given content type",
      "inputSchema": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "description": "Content type name" },
          "status": { "type": "string", "enum": ["draft", "published", "archived"] },
          "limit": { "type": "number" }
        }
      }
    },
    {
      "name": "get_content",
      "description": "Get a single document by ID",
      "inputSchema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" }
        },
        "required": ["id"]
      }
    },
    {
      "name": "create_content",
      "description": "Create a new document",
      "inputSchema": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "data": { "type": "object" },
          "status": { "type": "string" }
        },
        "required": ["type", "data"]
      }
    }
  ]
}
```

## Consequences

### Positive
- Agents auto-discover capabilities via MCP — no manual API doc reading
- Content is genuinely multi-channel — web, RSS, agent are all first-class
- Admin SPA is decoupled — can evolve independently of the API
- MCP integration makes Taichu a natural fit for AI agent workflows

### Negative
- Three API surfaces to maintain and document
- Breaking changes must be coordinated across all three
- MCP protocol is still evolving — potential breaking changes upstream
