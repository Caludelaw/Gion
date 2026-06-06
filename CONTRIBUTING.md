# Contributing to Gion

Thanks for your interest in contributing! Gion is an open-source, community-driven project. This guide will help you get started.

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, constructive, and inclusive.

## How Can I Contribute?

### Reporting Bugs

1. Check [existing issues](https://github.com/liuhuaian/gion/issues) to avoid duplicates
2. Use the **Bug Report** template when creating a new issue
3. Include:
   - Node.js version (`node --version`)
   - OS and architecture
   - Steps to reproduce
   - Expected vs actual behavior
   - Minimal reproduction code if possible

### Suggesting Features

1. Check the [Roadmap](docs/ROADMAP.md) to see if it's already planned
2. Open a **Feature Request** issue with:
   - Problem statement: what pain does this solve?
   - Proposed solution: how would it work?
   - Impact on existing architecture
   - Priority argument: why now?

### Architecture Decisions

Gion uses **Architecture Decision Records (ADRs)** to document significant technical choices. See [docs/architecture/](docs/architecture/) for existing decisions. If your contribution involves a significant architectural change, propose an ADR first.

### Pull Requests

#### Before You Start

1. **Find or create an issue** — discuss the approach before writing code
2. **Check the project board** — some issues are reserved for specific milestones
3. **Read the architecture docs** — understand the design principles

#### Development Setup

```bash
# Fork & clone
git clone https://github.com/YOUR_USERNAME/gion.git
cd gion

# Start development server
npm start

# Run tests
npm test

# Run linting
npm run lint
```

#### Code Standards

- **No external dependencies in `@gion/core`** — core must remain zero-dependency
- **ES modules only** — use `import`/`export`, not `require`
- **JSDoc for public APIs** — everything exported should have type annotations
- **2-space indentation** — see `.editorconfig`
- **No semicolons** — consistent style
- **Single quotes** for strings (except when avoiding escaping)

#### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add batch document creation endpoint
fix(server): handle empty request body gracefully
docs(readme): update quick start section
refactor(store): extract query builder to separate module
test(core): add content type validation edge cases
```

#### PR Process

1. Create a feature branch: `feat/my-feature` or `fix/my-bug`
2. Write code + tests
3. Run `npm test` and `npm run lint` — both must pass
4. Open a PR against `main`
5. Fill out the PR template completely
6. Wait for review — a maintainer will respond within 3 business days

#### PR Review Criteria

Your PR will be evaluated on:
- **Correctness** — does it work as described?
- **Simplicity** — is the implementation the simplest possible?
- **Test coverage** — are edge cases covered?
- **Architecture alignment** — does it follow Gion's design philosophy?
- **Documentation** — are public APIs documented?

### First-Time Contributors

Look for issues tagged `good first issue` — these are specifically curated for newcomers. Each includes:
- Clear acceptance criteria
- Pointers to relevant code
- Estimated complexity

## Project Philosophy

Before contributing, understand what Gion is — and isn't:

### Gion Is:
- A content infrastructure for the AI agent era
- Structured, semantic, API-first
- Agent-native: permissions, pipelines, audit trails
- Zero-dependency core
- Modular: pluggable storage, renderers, extensions

### Gion Is NOT:
- A WordPress clone with AI features bolted on
- A general-purpose web framework
- A blogging platform per se (though it can serve that use case)
- Trying to replace every CMS — it solves a specific problem

## Communication

- **Issues**: Bug reports, feature requests, and task tracking
- **Discussions**: Architecture debates, RFC proposals, community Q&A
- **Pull Requests**: Code contributions

Maintainers aim to respond within 3 business days. Please be patient — Gion is a community project maintained by volunteers.

---

Thanks for building the future of content management with us.
