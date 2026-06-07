/**
 * @gion/core — 核心模块测试
 *
 * 运行: node --test packages/core/src/core.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createContentType } from './content-type.js';
import { createMemoryStore } from './store.js';
import { createHookSystem } from './hooks.js';
import { hashPassword, verifyPassword, signJWT, verifyJWT, generateAPIKey, verifyAPIKey } from './auth.js';
import { GionError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from './errors.js';
import { createHmac } from 'node:crypto';

// ════════════════════════════════════════════════════════════
// Content Type
// ════════════════════════════════════════════════════════════

describe('ContentType', () => {
  it('should create a content type with fields', () => {
    const Article = createContentType('article', {
      label: '文章',
      fields: {
        title: { type: 'string', required: true, maxLength: 200 },
        slug:  { type: 'string', required: true },
        tags:  { type: 'array', items: { type: 'string' } }
      }
    });

    assert.equal(Article.name, 'article');
    assert.equal(Article.label, '文章');
    assert.equal(Object.keys(Article.fields).length, 3);
  });

  it('should validate a valid document', () => {
    const Article = createContentType('article', {
      fields: {
        title: { type: 'string', required: true },
        body:  { type: 'json' }
      }
    });

    const result = Article.validate({ title: 'Hello', body: {} });
    assert.equal(result.valid, true);
  });

  it('should reject missing required fields', () => {
    const Article = createContentType('article', {
      fields: { title: { type: 'string', required: true } }
    });

    const result = Article.validate({});
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
  });

  it('should validate string maxLength', () => {
    const Article = createContentType('article', {
      fields: { title: { type: 'string', maxLength: 10 } }
    });

    const result = Article.validate({ title: 'this is way too long' });
    assert.equal(result.valid, false);
  });

  it('should validate enum values', () => {
    const Article = createContentType('article', {
      fields: { status: { type: 'enum', values: ['draft', 'published'] } }
    });

    assert.equal(Article.validate({ status: 'draft' }).valid, true);
    assert.equal(Article.validate({ status: 'deleted' }).valid, false);
  });

  it('should export JSON Schema', () => {
    const Article = createContentType('article', {
      label: '文章',
      schemaOrg: 'Article',
      fields: {
        title: { type: 'string', required: true },
        tags:  { type: 'array', items: { type: 'string' } }
      }
    });

    const schema = Article.toJSONSchema();
    assert.equal(schema.title, '文章');
    assert.equal(schema.type, 'object');
    assert.ok(schema.required.includes('title'));
  });
});

// ════════════════════════════════════════════════════════════
// Store (Memory)
// ════════════════════════════════════════════════════════════

describe('MemoryStore', () => {
  it('should create and retrieve a document', async () => {
    const store = createMemoryStore();
    const doc = await store.create({ type: 'article', data: { title: 'Test' } });

    assert.ok(doc.id);
    assert.equal(doc.type, 'article');
    assert.equal(doc.data.title, 'Test');
    assert.equal(doc.status, 'draft');

    const got = await store.get(doc.id);
    assert.equal(got.data.title, 'Test');
  });

  it('should list documents by type', async () => {
    const store = createMemoryStore();
    await store.create({ type: 'article', data: { title: 'A' } });
    await store.create({ type: 'article', data: { title: 'B' } });
    await store.create({ type: 'page',    data: { title: 'C' } });

    const articles = await store.list({ type: 'article' });
    assert.equal(articles.length, 2);

    const pages = await store.list({ type: 'page' });
    assert.equal(pages.length, 1);
  });

  it('should filter by status', async () => {
    const store = createMemoryStore();
    await store.create({ type: 'article', data: { title: 'A' }, status: 'draft' });
    await store.create({ type: 'article', data: { title: 'B' }, status: 'published' });

    const drafts = await store.list({ type: 'article', status: 'draft' });
    assert.equal(drafts.length, 1);
  });

  it('should update a document', async () => {
    const store = createMemoryStore();
    const doc = await store.create({ type: 'article', data: { title: 'Old' } });

    const updated = await store.update(doc.id, { data: { title: 'New' } });
    assert.equal(updated.data.title, 'New');
  });

  it('should delete a document', async () => {
    const store = createMemoryStore();
    const doc = await store.create({ type: 'article', data: {} });

    const deleted = await store.delete(doc.id);
    assert.equal(deleted, true);

    const got = await store.get(doc.id);
    assert.equal(got, null);
  });

  it('should count documents', async () => {
    const store = createMemoryStore();
    await store.create({ type: 'article', data: {} });
    await store.create({ type: 'article', data: {} });
    await store.create({ type: 'page',    data: {} });

    const count = await store.count({ type: 'article' });
    assert.equal(count, 2);
  });
});

// ════════════════════════════════════════════════════════════
// Hook System
// ════════════════════════════════════════════════════════════

describe('HookSystem', () => {
  it('should run registered hooks', async () => {
    const hooks = createHookSystem();
    const calls = [];

    hooks.on('test', async (payload) => {
      calls.push(payload);
    });

    await hooks.run('test', 'hello');
    assert.deepEqual(calls, ['hello']);
  });

  it('should run hooks in priority order', async () => {
    const hooks = createHookSystem();
    const order = [];

    hooks.on('test', () => { order.push('low'); }, 20);
    hooks.on('test', () => { order.push('high'); }, 5);

    await hooks.run('test', null);
    assert.deepEqual(order, ['high', 'low']);
  });

  it('should pass payload through hooks', async () => {
    const hooks = createHookSystem();

    hooks.on('transform', async (payload) => (typeof payload === 'string' ? payload.toUpperCase() : null));

    const result = await hooks.run('transform', 'hello');
    assert.equal(result, 'HELLO');
  });

  it('should stop chain when handler returns null', async () => {
    const hooks = createHookSystem();
    const calls = [];

    hooks.on('test', () => { calls.push(1); return null; });
    hooks.on('test', () => { calls.push(2); });

    await hooks.run('test', null);
    assert.deepEqual(calls, [1]);
  });

  it('should deregister hooks', async () => {
    const hooks = createHookSystem();
    const calls = [];

    const dereg = hooks.on('test', () => { calls.push(1); });
    dereg();
    await hooks.run('test', null);

    assert.deepEqual(calls, []);
  });
});

// ════════════════════════════════════════════════════════════
// Auth
// ════════════════════════════════════════════════════════════

describe('Password Hashing', () => {
  it('should hash and verify a password', () => {
    const hashed = hashPassword('gion2026');
    assert.ok(hashed.startsWith('pbkdf2_sha256$'));

    assert.equal(verifyPassword('gion2026', hashed), true);
  });

  it('should reject wrong password', () => {
    const hashed = hashPassword('correct');
    assert.equal(verifyPassword('wrong', hashed), false);
  });

  it('should produce different hashes for same password', () => {
    const h1 = hashPassword('test');
    const h2 = hashPassword('test');
    assert.notEqual(h1, h2, 'Salt should produce different hashes');
    assert.equal(verifyPassword('test', h1), true);
    assert.equal(verifyPassword('test', h2), true);
  });

  it('should handle malformed hash gracefully', () => {
    assert.equal(verifyPassword('test', 'bad_hash'), false);
  });
});

describe('JWT', () => {
  const secret = 'test-secret-key-32-chars-long!!';

  it('should sign and verify a JWT', () => {
    const token = signJWT({ sub: 'user-1', role: 'admin' }, secret, { expiresIn: '1h' });
    assert.ok(typeof token === 'string');

    const result = verifyJWT(token, secret);
    assert.equal(result.valid, true);
    assert.equal(result.payload.sub, 'user-1');
    assert.equal(result.payload.role, 'admin');
  });

  it('should reject tokens with exp in the past', () => {
    const expiredPayload = { sub: 'user-1', iat: Math.floor(Date.now() / 1000) - 7200, exp: Math.floor(Date.now() / 1000) - 3600 };
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const headerB64 = Buffer.from(header).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url');
    const token = `${headerB64}.${payloadB64}.${sig}`;

    const result = verifyJWT(token, secret);
    assert.equal(result.valid, false);
    assert.equal(result.error, 'Token expired');
  });

  it('should reject tokens with wrong secret', () => {
    const token = signJWT({ sub: 'user-1' }, secret);
    const result = verifyJWT(token, 'wrong-secret');
    assert.equal(result.valid, false);
  });
});

describe('API Key', () => {
  it('should generate a valid API key', () => {
    const key = generateAPIKey('Test Agent');
    assert.ok(key.key.startsWith('gion_'));
    assert.ok(key.prefix.startsWith('gion_'));
    assert.equal(key.label, 'Test Agent');
    assert.equal(key.key.length, 69); // gion_ + 64 hex chars
  });

  it('should verify a valid API key', () => {
    const key = generateAPIKey('Test');
    assert.equal(verifyAPIKey(key.key, key.hash), true);
  });

  it('should reject invalid API key', () => {
    const key = generateAPIKey('Test');
    assert.equal(verifyAPIKey('gion_fake', key.hash), false);
  });

  it('should produce different keys each time', () => {
    const k1 = generateAPIKey();
    const k2 = generateAPIKey();
    assert.notEqual(k1.key, k2.key);
    assert.notEqual(k1.hash, k2.hash);
  });
});

// ════════════════════════════════════════════════════════════
// Errors
// ════════════════════════════════════════════════════════════

describe('GionError', () => {
  it('should create a base error', () => {
    const err = new GionError('test');
    assert.equal(err.message, 'test');
    assert.equal(err.status, 500);
    assert.equal(err.code, 'GION_ERROR');
  });

  it('should create typed errors with correct status codes', () => {
    assert.equal(new ValidationError('bad').status, 400);
    assert.equal(new NotFoundError('missing').status, 404);
    assert.equal(new UnauthorizedError('nope').status, 401);
    assert.equal(new ForbiddenError('no').status, 403);
    assert.equal(new ConflictError('dup').status, 409);
  });

  it('should serialize to JSON', () => {
    const err = new ValidationError('Invalid title');
    const json = err.toJSON();
    assert.equal(json.error, 'VALIDATION_ERROR');
    assert.equal(json.message, 'Invalid title');
    assert.equal(json.status, 400);
  });
});
