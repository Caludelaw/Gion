# ADR 001: Zero-Dependency Core Runtime

- **Status:** Accepted
- **Date:** 2026-06-06
- **Author:** Liu Huai'an

## Context

We need to choose the dependency strategy for Taichu's core runtime (`@taichu/core` and `@taichu/server`). The options range from full-framework (Express/Fastify + ORM + etc.) to zero-dependency (Node.js built-ins only).

## Decision Drivers

1. **Auditability** — open-source contributors must be able to understand every line of code
2. **Longevity** — the project should remain viable for 10+ years without dependency churn
3. **Performance** — minimal overhead for core operations
4. **Install simplicity** — `git clone && npm start` should work immediately
5. **Extensibility** — power users can swap in heavier dependencies when needed

## Options Considered

### Option A: Full Framework (Express + Prisma + etc.)

- **Pros**: Rapid development, familiar patterns, large ecosystem
- **Cons**: Heavy dependency tree, breaking changes risk, "magic" behavior

### Option B: Minimal Dependencies (Fastify or Hono)

- **Pros**: Lighter than Express, modern APIs, maintained
- **Cons**: Still external dependencies, version drift risk

### Option C: Zero Dependencies (Node.js built-ins only)

- **Pros**: Maximum auditability, zero supply-chain risk, instant startup, eternal viability
- **Cons**: More code to write, less "batteries included"

## Decision

**We choose Option C: Zero Dependencies for the core runtime.**

The core packages (`@taichu/core`, `@taichu/server`) use only Node.js built-in modules. Optional dependencies (SQLite driver, vector store) are isolated in separate packages.

## Consequences

### Positive

- `git clone && npm start` works with zero `npm install` for core
- Every line of code is auditable by any Node.js developer
- No left-pad incidents, no dependency confusion attacks
- Cold start time is measured in milliseconds, not seconds

### Negative

- We write our own HTTP router, body parser, and middleware stack
- Fewer "batteries included" — developers migrating from Express need to learn our API
- Some features (file upload parsing, WebSocket) require more effort

### Mitigations

- Clear JSDoc documentation for all public APIs
- The API design is intentionally similar to familiar patterns (middleware stack, context object)
- Complex features that truly need external deps are in separate packages (e.g., `@taichu/driver-sqlite`)
