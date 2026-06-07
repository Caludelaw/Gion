# Taichu API Documentation

## Overview

Taichu is API-first. Everything you can do in the admin UI, you can do via the API.

- **Base URL**: `http://localhost:3120/api`
- **Content-Type**: `application/json`
- **Authentication**: JWT (humans) or API Key (agents) — coming in Phase 2

## Endpoints

### Health Check

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "name": "taichu",
  "version": "0.1.0",
  "uptime": 123.456
}
```

### Content Types

```
GET /api/content-types
```

Returns all registered content types.

```
GET /api/content-types/:name
```

Returns the JSON Schema for a specific content type.

### Content CRUD

```
GET    /api/content/:type          # List documents of type
POST   /api/content/:type          # Create a document
GET    /api/content/:type/:id      # Get a single document
PUT    /api/content/:type/:id      # Update a document
DELETE /api/content/:type/:id      # Delete a document
```

#### Query Parameters (for `GET /api/content/:type`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`draft`, `published`, `archived`) |
| `search` | string | Full-text search across document data |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |
| `orderBy` | string | Sort field (default: `updatedAt`) |
| `order` | string | Sort direction (`asc` or `desc`, default: `desc`) |

#### Examples

```bash
# List all published articles
curl http://localhost:3120/api/content/article?status=published

# Create a new article
curl -X POST http://localhost:3120/api/content/article \
  -H "Content-Type: application/json" \
  -d '{"data":{"title":"Hello World","body":{"text":"First post!"}}}'

# Update an article
curl -X PUT http://localhost:3120/api/content/article/doc-123 \
  -H "Content-Type: application/json" \
  -d '{"data":{"title":"Updated Title"}}'

# Delete an article
curl -X DELETE http://localhost:3120/api/content/article/doc-123
```

## Error Responses

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "status": 400
}
```

Error codes:
- `VALIDATION_ERROR` (400) — request body doesn't match content type schema
- `NOT_FOUND` (404) — resource doesn't exist
- `UNAUTHORIZED` (401) — missing or invalid credentials (Phase 2)
- `FORBIDDEN` (403) — insufficient permissions (Phase 2)
- `CONFLICT` (409) — resource conflict (e.g., duplicate slug)
- `INTERNAL_ERROR` (500) — unexpected server error
