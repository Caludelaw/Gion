# ADR 003: Hook-Based Extension System

- **Status:** Accepted
- **Date:** 2026-06-06
- **Author:** Liu Huai'an

## Context

Taichu needs an extension system that allows both:
1. Traditional plugin-style functionality (similar to WordPress's `add_action`/`add_filter`)
2. Agent-native capabilities (agents registering themselves in content pipelines)

The extension model must be simple enough for community contributors, yet powerful enough for complex agent workflows.

## Decision Drivers

1. **Familiarity** — WordPress's hook system is the most successful plugin API in CMS history
2. **Agent-compatibility** — hooks must support async operations (agents may call external LLMs)
3. **Determinism** — priority ordering must be predictable
4. **No global state** — hooks are scoped to a Taichu instance, not global

## Options Considered

### Option A: EventEmitter (Node.js built-in)

Too low-level. No priority ordering. No return value chaining (filter semantics).

### Option B: WordPress-style add_action/add_filter

Proven model. But WordPress uses global state, which doesn't scale to multi-tenant or serverless.

### Option C: Instance-Scoped Lifecycle Hooks (our approach)

Inspired by WordPress but scoped to a Taichu instance. Named lifecycle hooks with priority ordering. Supports both side-effect hooks (action-like) and value-passing hooks (filter-like).

## Decision

**Taichu uses an instance-scoped hook system with WordPress-compatible semantics.**

```js
const taichu = createTaichu();

// Side-effect hook (action)
taichu.hooks.on('afterCreate', async (doc, ctx) => {
  await searchIndex.index(doc);
});

// Value-passing hook (filter)
taichu.hooks.on('beforeRender', async (html, ctx) => {
  return addAnalytics(html);
}, 5); // priority 5 — runs before default (10)
```

## Built-in Hooks

| Hook | Type | Payload | When |
|------|------|---------|------|
| `beforeCreate` | Filter | `{ type, data, status }` | Before document creation |
| `afterCreate` | Action | `Document` | After document creation |
| `beforeUpdate` | Filter | `{ id, type, data, status }` | Before document update |
| `afterUpdate` | Action | `Document` | After document update |
| `beforeDelete` | Filter | `{ id, type }` | Before document deletion |
| `afterDelete` | Action | `{ id, type }` | After document deletion |
| `beforePublish` | Filter | `Document` | Before status change to published |
| `afterPublish` | Action | `Document` | After status change to published |
| `beforeRender` | Filter | `html, ctx` | Before HTML output |
| `afterRender` | Action | `html, ctx` | After HTML output |
| `agent:onRequest` | Filter | `payload, ctx` | Agent API request received |
| `agent:onResponse` | Filter | `response, ctx` | Agent API response prepared |

## Consequences

### Positive
- WordPress developers will find the API familiar
- Async support enables agent-in-the-loop workflows
- Instance scoping prevents multi-tenant conflicts
- Priority system ensures deterministic execution order

### Negative
- Not compatible with existing WordPress plugins (different runtime)
- Hook naming convention must be documented clearly
- Community needs guidance on "which hook to use" for common tasks
