# Gion Development Roadmap

## Phase 1: Core CMS (Current — Alpha)

**Goal**: A working headless CMS with structured content, REST API, and hook-based extension system.

| Feature | Status | Package |
|---------|--------|---------|
| Content Type Schema Definition | Done | `@gion/core` |
| Typed Field Validation | Done | `@gion/core` |
| Memory Store (dev/testing) | Done | `@gion/core` |
| Hook System (lifecycle hooks) | Done | `@gion/core` |
| Structured Error Types | Done | `@gion/core` |
| Zero-Dependency HTTP Server | Done | `@gion/server` |
| REST API (CRUD + list) | Done | `@gion/server` |
| CORS Middleware | Done | `@gion/server` |
| JSON Body Parser | Done | `@gion/server` |
| Architecture Decision Records | Done | `docs/` |
| SQLite Store | Todo | `@gion/driver-sqlite` |
| Authentication (JWT + API Key) | Todo | `@gion/auth` |
| File Upload | Todo | `@gion/server` |
| CLI Tool (`gion init`, `gion dev`) | Todo | `@gion/cli` |

## Phase 2: AI-Native (Planned)

**Goal**: AI agents become first-class content consumers and producers.

| Feature | Priority |
|---------|----------|
| Agent API Key Authentication | P0 |
| Agent Rate Limiting & Quotas | P0 |
| Agent Audit Trail | P0 |
| MCP Server Implementation | P0 |
| Vector Search (sqlite-vss / LanceDB) | P1 |
| GraphQL API | P1 |
| Content Auto-Tagging (LLM) | P1 |
| Content Pipeline Engine (collect → clean → enhance → review → publish) | P1 |
| Agent Permission Scopes (read/write per content type) | P1 |

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

- **Gion as content backbone for AI agent ecosystems** — every agent in a workflow uses Gion as its shared content infrastructure
- **Federated content networks** — Gion instances discover and share content via ActivityPub
- **Agent marketplace** — developers publish agent capabilities as installable extensions
- **Zero-config HA** — SQLite + Litestream for production-grade durability with single-binary simplicity
