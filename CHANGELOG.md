# Taichu CMS Changelog

## v0.7.0 (2026-06-15)

### 🆕 New Features
- **Comment System** — Admin management dashboard + blog theme frontend integration
- **Enhanced User Management** — Role editor, shared utility modules, improved UI components
- **Content Draft Auto-Save** — Debounced localStorage persistence, restore on mount, clear on save, beforeunload warning
- **Tag Management Admin UI** — Full CRUD interface for content tags
- **Admin Dark Mode** — `[data-theme='dark']` CSS variables, toggle with localStorage persistence, system preference detection
- **Responsive Admin UI** — Hamburger sidebar, mobile overlay, responsive tables/forms, 768px/1024px breakpoints

### 🏗️ Developer Experience
- **Git Pre-Commit Hooks** — Lint + test auto-run before commits
- **Code Quality Refactoring** — DRY utils extraction, shared base CSS, consistent variable naming
- **E2E Tests (Playwright)** — 18 specs covering auth, content CRUD, admin UI, dark mode
- **Performance Optimization** — Lazy-load routes + vendor chunk split (main bundle: 576KB → 18.5KB, 44 chunks)

### 📚 Documentation
- **API Reference Page** — 14 sections, 50+ endpoints, curl examples, sidebar navigation
- **Plugin Developer Guide** — Complete plugin development documentation

### 🚀 Infrastructure
- **Aliyun ACR Docker Mirror** — Automated multi-registry publish (GHCR + Aliyun ACR)

---

## v0.6.0 (2026-06-07)

### Features
- Dashboard Charts (content stats, trend graphs)
- Theme Frontend Pagination (blog list pages)
- Content Relationships Graph UI (admin visualization)
- Media Selector in Rich Editor
- Batch Operations (bulk delete/publish)
- Second Official Theme (minimal/portfolio)
- SSO OIDC Callback Handler
- Custom Field Types (date, boolean, reference)
- Content Export (JSON, Markdown, CSV)
- Webhook Retry with Exponential Backoff

---

## v0.5.0

### Features
- Server Integration Tests (51 tests)
- Brand Icon Redesign (Tai Chi ball)
- Scheduled Publishing
- Version Diff API
- Docker Compose One-Click Deploy
- Media Library Enhancement (compress/WebP/thumbs)
- Email Notification Channel
- Content Relationship Graph
- Multi-Tenant Support
- Plugin Marketplace (frontend + CLI)
- ActivityPub Federation

---

## v0.4.0

Initial public release — AI Agent-Native CMS core with:
- Structured content models with JSON-LD semantic mapping
- Zero-dependency core (Node.js built-ins only)
- REST + GraphQL + MCP + WebSocket multi-channel API
- Vue 3 Admin SPA (18 pages)
- Hook-based lifecycle extension system
- Built-in blog theme with custom upload support
