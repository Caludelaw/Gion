# Taichu Development Roadmap

## Phase 1: Core CMS ✅ COMPLETE

**Goal**: A working headless CMS with structured content, REST API, and hook-based extension system.

| Feature | Status | Package |
|---------|--------|---------|
| Content Type Schema Definition | ✅ Done | `@taichu/core` |
| Typed Field Validation | ✅ Done | `@taichu/core` |
| Memory Store (dev/testing) | ✅ Done | `@taichu/core` |
| Hook System (lifecycle hooks) | ✅ Done | `@taichu/core` |
| Structured Error Types | ✅ Done | `@taichu/core` |
| Zero-Dependency HTTP Server | ✅ Done | `@taichu/server` |
| REST API (CRUD + list) | ✅ Done | `@taichu/server` |
| CORS Middleware | ✅ Done | `@taichu/server` |
| JSON Body Parser | ✅ Done | `@taichu/server` |
| Architecture Decision Records | ✅ Done | `docs/` |
| SQLite Store (sql.js WASM) | ✅ Done | `@taichu/core` |
| Authentication (JWT + API Key) | ✅ Done | `@taichu/core` |
| Vue 3 Admin SPA | ✅ Done | `@taichu/admin` |
| Static File Serving | ✅ Done | `@taichu/server` |

## Phase 2: AI-Native ✅ COMPLETE

**Goal**: AI agents become first-class content consumers and producers.

| Feature | Status |
|---------|--------|
| Agent API Key Authentication | ✅ Done |
| JWT Authentication (Human) | ✅ Done |
| MCP Server (stdio transport) | ✅ Done |
| TF-IDF Vector Search | ✅ Done |
| Content Auto-Indexing (hook-based) | ✅ Done |
| GraphQL API | Todo |
| Content Pipeline Engine | Todo |
| Agent Permission Scopes | Todo |

## Phase 3: Ecosystem (Planned)

**Goal**: A thriving developer ecosystem with extensions, themes, and multi-agent workflows.

| Feature | Priority |
|---------|----------|
| Extension Marketplace | P0 |
| Multi-Agent Collaboration (conflict resolution) | P0 |
| WebSocket Real-Time Updates | P1 |
| ActivityPub Federation | P1 |
| Content Relationship Graph | P1 |
| Adaptive API (auto-detect client type) | P2 |
| Multi-Tenant Support | P2 |
| Plugin SDK & Documentation | P2 |
| Theme System (for public frontend) | P2 |

## Long-Term Vision

- **Taichu as content backbone for AI agent ecosystems** — every agent in a workflow uses Taichu as its shared content infrastructure
- **Federated content networks** — Taichu instances discover and share content via ActivityPub
- **Agent marketplace** — developers publish agent capabilities as installable extensions
- **Zero-config HA** — SQLite + Litestream for production-grade durability with single-binary simplicity
