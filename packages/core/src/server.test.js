/**
 * Server module tests — rate limiter, revisions, audit, pipeline
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ════════════════════════════════════════════════════════════
// Rate Limiter
// ════════════════════════════════════════════════════════════

describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    const { rateLimit } = await import('../../server/src/middleware/rate-limit.js');
    // Create a mock ctx
    const ctx = { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res: { writeHead() {}, end() {} }, url: new URL('http://localhost/test') };
    // First requests should pass
    for (let i = 0; i < 5; i++) {
      assert.equal(rateLimit(ctx), true);
    }
  });

  it('should track by IP', async () => {
    const { rateLimit } = await import('../../server/src/middleware/rate-limit.js');
    const ctx = { req: { headers: {}, socket: { remoteAddress: '10.0.0.1' } }, res: { writeHead() {}, end() {} }, url: new URL('http://localhost/test') };
    assert.equal(rateLimit(ctx), true);
  });
});

// ════════════════════════════════════════════════════════════
// Revisions & Diff
// ════════════════════════════════════════════════════════════

describe('Revisions', () => {
  it('should diff two objects', async () => {
    const { diffObjects } = await import('../../server/src/revisions.js');
    const changes = diffObjects(
      { title: 'Old', body: 'same' },
      { title: 'New', body: 'same' }
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0].field, 'title');
    assert.equal(changes[0].from, 'Old');
    assert.equal(changes[0].to, 'New');
  });

  it('should detect added fields', async () => {
    const { diffObjects } = await import('../../server/src/revisions.js');
    const changes = diffObjects(
      { title: 'Same' },
      { title: 'Same', body: 'new field' }
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0].field, 'body');
  });

  it('should return empty for identical objects', async () => {
    const { diffObjects } = await import('../../server/src/revisions.js');
    const changes = diffObjects({ a: 1, b: [2] }, { a: 1, b: [2] });
    assert.equal(changes.length, 0);
  });
});

// ════════════════════════════════════════════════════════════
// Pipeline Engine
// ════════════════════════════════════════════════════════════

describe('PipelineEngine', () => {
  it('should list built-in templates', async () => {
    const { TEMPLATES } = await import('../../server/src/pipeline.js');
    assert.ok(TEMPLATES.translation);
    assert.ok(TEMPLATES.seo);
    assert.ok(TEMPLATES.review);
    assert.equal(Object.keys(TEMPLATES).length, 3);
  });

  it('should have correct step counts', async () => {
    const { TEMPLATES } = await import('../../server/src/pipeline.js');
    assert.equal(TEMPLATES.translation.steps.length, 4);
    assert.equal(TEMPLATES.seo.steps.length, 5);
    assert.equal(TEMPLATES.review.steps.length, 2);
  });
});

// ════════════════════════════════════════════════════════════
// Review Policy
// ════════════════════════════════════════════════════════════

describe('ReviewPolicy', () => {
  it('should approve non-agent content', async () => {
    const { ReviewPolicy } = await import('../../server/src/pipeline.js');
    const policy = new ReviewPolicy({ requireHumanReview: true });
    const result = policy.evaluate({ data: { title: 'test' } });
    assert.equal(result.approved, true);
  });

  it('should block agent content when requireHumanReview is true', async () => {
    const { ReviewPolicy } = await import('../../server/src/pipeline.js');
    const policy = new ReviewPolicy({ requireHumanReview: true });
    const result = policy.evaluate({ data: { title: 'test' }, _meta: { createdBy: { type: 'agent' } } });
    assert.equal(result.approved, false);
  });

  it('should allow agent content without review requirement', async () => {
    const { ReviewPolicy } = await import('../../server/src/pipeline.js');
    const policy = new ReviewPolicy({ requireHumanReview: false });
    const result = policy.evaluate({ data: {}, _meta: { createdBy: { type: 'agent' } } });
    assert.equal(result.approved, true);
  });
});

// ════════════════════════════════════════════════════════════
// LLM Providers
// ════════════════════════════════════════════════════════════

describe('LLMProviders', () => {
  it('should list all providers', async () => {
    const { listProviders, createProvider } = await import('../../llm-providers/src/index.js');
    const providers = listProviders();
    assert.ok(providers.includes('qwen'));
    assert.ok(providers.includes('deepseek'));
    assert.ok(providers.includes('ernie'));
    assert.ok(providers.includes('moonshot'));
  });

  it('should create a provider instance', async () => {
    const { createProvider } = await import('../../llm-providers/src/index.js');
    const provider = createProvider('deepseek', { apiKey: 'test-key' });
    assert.equal(provider.defaultModel, 'deepseek-chat');
    assert.ok(provider.baseURL.includes('deepseek.com'));
  });
});

// ════════════════════════════════════════════════════════════
// Auth Provider
// ════════════════════════════════════════════════════════════

describe('AuthProviders', () => {
  it('should list default providers', async () => {
    const { listProviders } = await import('../../server/src/auth-provider.js');
    const providers = listProviders();
    assert.ok(providers.includes('email'));
  });

  it('should register a custom provider', async () => {
    const { registerProvider, getProvider } = await import('../../server/src/auth-provider.js');
    registerProvider('test-provider', { getName: () => 'test-provider' });
    assert.ok(getProvider('test-provider'));
  });
});
