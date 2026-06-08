<p align="center">
  <img src="docs/logo.svg" alt="Taichu" width="360" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="License: MIT" /></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node.js >= 18" /></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg" alt="Contributions Welcome" /></a>
  <a href="#"><img src="https://img.shields.io/badge/stage-alpha-orange.svg" alt="Alpha Stage" /></a>
</p>

---

## What is Taichu?

Taichu is a **content management system built for the AI agent era**. While WordPress and Typecho were architected for human authors editing HTML in a browser, Taichu is architected for a world where AI agents are first-class content producers and consumers.

### The Problem

- **WordPress / Typecho** store content as HTML strings in a database, designed for one human editing in a WYSIWYG editor and another human reading on a themed page
- **Headless CMS** (Strapi, Directus) separate content from presentation, but are still designed for human authors
- **AI agents** need structured, semantic content with discoverable APIs, fine-grained permissions, and content pipelines

### Our Answer

Taichu treats **AI agents as first-class citizens** alongside human authors:

| | Traditional CMS | Headless CMS | **Taichu** |
|---|---|---|---|
| Authors | Humans only | Humans only | **Humans + AI Agents** |
| Content format | HTML strings | Structured JSON | **Semantic JSON-LD** |
| API | Afterthought (REST API plugin) | Primary (REST / GraphQL) | **Native (REST + GraphQL + MCP)** |
| Search | SQL LIKE | Full-text index | **Vector + Semantic** |
| Plugin model | Human-oriented (widgets, SEO) | Webhooks | **Agent Capability Extensions** |
| Permissions | Role-based (admin/editor/author) | Role-based | **Identity-based (Human + Agent + Scope)** |
| Deployment | LAMP stack | Docker / Cloud | **Single binary or Docker** |

---

## Philosophy

### Content as Data, Not HTML

Taichu stores structured data — not HTML blobs. An article is a document with typed fields (`title: string`, `body: json`, `tags: array`), not a `wp_post` row with a `post_content` column full of HTML.

This means:
- AI agents can read and write content without parsing HTML
- Rendering is separated from storage — same content can be a web page, RSS feed, or agent response
- Relationships are native — fields can be typed as `relation` to other content types
- Search is semantic — embedding vectors live alongside structured fields

### Agents Are First-Class Citizens

Every API endpoint, permission, and workflow is designed for both human and agent consumers:

```bash
# Human access (JWT)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://taichu.example.com/api/content/article

# Agent access (API Key)
curl -H "X-Taichu-Agent-Key: $AGENT_KEY" \
  https://taichu.example.com/api/content/article
```

Agent-specific features:
- **Rate limiting per agent** — prevent runaway agents from overwhelming the system
- **Content pipelines** — agents can register as processors in content workflows
- **Audit trails** — every agent action is logged and attributable
- **MCP protocol** — agents discover Taichu's capabilities automatically via Model Context Protocol (Phase 2)

### Zero Dependencies (Core)

The core runtime depends only on Node.js built-in modules. No npm install dance, no dependency hell. This is a deliberate choice:

- **Auditability** — every line of code can be reviewed
- **Longevity** — no risk of left-pad incidents
- **Performance** — no framework overhead
- **Simplicity** — `git clone && npm start` just works

*Optional dependencies (SQLite driver, vector store) will be clearly documented and isolated.*

### Extensible by Design

Like WordPress's plugin system, but for agents:

```js
// Register a content type
taichu.registerContentType(createContentType('product', {
  label: 'Product',
  fields: {
    name: { type: 'string', required: true },
    price: { type: 'number' },
    description: { type: 'json' }
  }
}));

// Hook into the content pipeline
taichu.hooks.on('afterCreate', async (doc, ctx) => {
  if (doc.type === 'article') {
    await autoGenerateExcerpt(doc);
    await indexForSearch(doc);
  }
});

// Agent capability extension
taichu.hooks.on('agent:onRequest', async (payload, ctx) => {
  if (ctx.agent.scope === 'seo-optimizer') {
    payload.enhancements = ['keywords', 'readability'];
  }
});
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/Caludelaw/Taichu.git
cd taichu

# Run (yes, that's it — zero npm install needed for core)
npm start

# Taichu is now running at http://localhost:3120
# Health check: http://localhost:3120/api/health
```

### Create Your First Content

```bash
# Create a document
curl -X POST http://localhost:3120/api/content/article \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "Hello Taichu",
      "body": {"text": "Welcome to the agent-native CMS."},
      "status": "published"
    }
  }'

# List all articles
curl http://localhost:3120/api/content/article

# Get a single article
curl http://localhost:3120/api/content/article/<id>
```

---

## Project Structure

```
taichu/
├── packages/
│   ├── core/           # Content model, storage abstraction, hook system
│   │   └── src/
│   │       ├── content-type.js   # Schema definition & validation
│   │       ├── store.js          # Storage interface + MemoryStore
│   │       ├── hooks.js          # Lifecycle hook system
│   │       └── errors.js         # Structured error types
│   ├── server/         # HTTP server (zero-dependency)
│   │   └── src/
│   │       ├── index.js          # Server entry point
│   │       ├── router.js         # URL routing
│   │       ├── context.js        # Request context
│   │       └── routes/
│   │           └── api.js        # REST API implementation
│   ├── mcp/            # MCP Server (Phase 2)
│   └── admin/          # Vue 3 Admin SPA (Phase 2)
├── docs/
│   ├── architecture/   # Architecture Decision Records (ADRs)
│   ├── api/            # API documentation
│   └── guides/         # User & developer guides
├── .github/
│   └── workflows/      # CI/CD pipelines
├── LICENSE             # MIT
├── CONTRIBUTING.md     # Contribution guide
└── CODE_OF_CONDUCT.md  # Community standards
```

---

## Development Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Core CMS: content model, REST API, memory store | 🚧 Alpha |
| **Phase 2** | AI-Native: vector search, MCP, agent permissions, GraphQL | 📋 Planned |
| **Phase 3** | Ecosystem: extension marketplace, multi-agent collaboration, federation | 📋 Planned |

See [ROADMAP.md](docs/ROADMAP.md) for details.

---

## Contributing

Taichu is in active early development. We welcome contributions from developers who share our vision of agent-native content infrastructure.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, and check [GitHub Issues](https://github.com/Caludelaw/Taichu/issues) for tasks tagged `good first issue`.

---

## License

MIT © 2026 Liu Huai'an and Taichu contributors. See [LICENSE](LICENSE).
