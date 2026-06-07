# ADR 002: Structured Content Model with JSON-LD

- **Status:** Accepted
- **Date:** 2026-06-06
- **Author:** Liu Huai'an

## Context

Traditional CMS (WordPress, Typecho) store content as HTML strings in a `post_content` column. Headless CMS (Strapi, Directus) store structured JSON but without semantic markup. For an agent-native CMS, we need content to be both structured and semantically meaningful.

## Decision Drivers

1. **Machine readability** — AI agents must be able to parse and understand content without HTML scraping
2. **Semantic interoperability** — content should map to standard vocabularies (schema.org, JSON-LD)
3. **Multi-format output** — same content should render as HTML, RSS, JSON-LD, or agent response
4. **Validation** — content type schemas should be enforceable at the API level

## Options Considered

### Option A: HTML String Storage (WordPress model)

Rejected: AI agents must parse HTML to extract meaning. Loses structured data. Not forward-compatible.

### Option B: Generic JSON (Strapi model)

Rejected: Structured but not semantic. No standard way to map fields to schema.org types. Agents must guess what each field means.

### Option C: JSON-LD with Content Type Schemas (our approach)

Accepted: Each content type registers a schema (typed fields + validation rules + optional schema.org mapping). Documents are stored as structured JSON. The API can output JSON-LD for search engines and structured JSON for agents.

## Decision

**Taichu uses typed content type schemas with optional JSON-LD semantic markup.**

Each content type:
1. Defines typed fields (`string`, `number`, `json`, `array`, `enum`, `datetime`, `media`, `relation`)
2. Has validation rules (required, maxLength, pattern, enum values)
3. Can map to a schema.org type (e.g., `schemaOrg: 'Article'`)
4. Fields can have semantic property mappings (e.g., `semantic: 'headline'`)

## Content Type Example

```js
const Article = createContentType('article', {
  label: 'Article',
  schemaOrg: 'Article',
  fields: {
    title:    { type: 'string',  required: true,  semantic: 'headline' },
    body:     { type: 'json',    required: true,  semantic: 'articleBody' },
    excerpt:  { type: 'string',  maxLength: 500,  semantic: 'description' },
    author:   { type: 'relation', target: 'author', semantic: 'author' },
    tags:     { type: 'array',   items: { type: 'string' }, semantic: 'keywords' },
    publishedAt: { type: 'datetime', semantic: 'datePublished' }
  }
});
```

## Consequences

### Positive
- Content is machine-readable by default
- Schema validation at the API layer catches errors early
- JSON-LD output is SEO-friendly and search-engine compatible
- Agents can introspect content types to understand available fields

### Negative
- More upfront design work to define content types
- Migration from HTML-based CMS requires content extraction
- Not all content naturally fits a typed schema (handled by `json` type for free-form fields)
