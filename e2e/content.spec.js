// E2E: Content CRUD flow tests
import { test, expect } from '@playwright/test'
import { registerTestUser, createArticle, deleteArticle } from './helpers.js'

test.describe('Content CRUD', () => {
  let user
  let articleId

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, '_crud')
  })

  test.afterAll(async ({ request }) => {
    if (articleId) await deleteArticle(request, user.token, articleId)
  })

  test('should create an article via API', async ({ request }) => {
    const article = await createArticle(request, user.token)
    expect(article.id).toBeTruthy()
    expect(article.type).toBe('article')
    expect(article.status).toBe('draft')
    articleId = article.id
  })

  test('should list articles and include the created one', async ({ request }) => {
    const res = await request.get('http://localhost:3129/api/content/article', {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    const body = await res.json()
    expect(body.total).toBeGreaterThanOrEqual(1)
    const ids = body.docs.map(d => d.id)
    expect(ids).toContain(articleId)
  })

  test('should get a single article by id', async ({ request }) => {
    const res = await request.get(`http://localhost:3129/api/content/article/${articleId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(articleId)
    expect(body.data.title).toBe('E2E Test Article')
  })

  test('should update an article', async ({ request }) => {
    const res = await request.put(`http://localhost:3129/api/content/article/${articleId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        data: { title: 'Updated E2E Article' },
        status: 'published',
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('Updated E2E Article')
    expect(body.status).toBe('published')
  })

  test('should delete an article', async ({ request }) => {
    // Create a fresh one to delete
    const temp = await createArticle(request, user.token, { title: 'To Delete', slug: `to-delete-${Date.now()}` })
    const res = await request.delete(`http://localhost:3129/api/content/article/${temp.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res.status()).toBe(200)
    articleId = null // Already deleted by the update test

    // Verify it's gone
    const res2 = await request.get(`http://localhost:3129/api/content/article/${temp.id}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res2.status()).toBe(404)
  })

  test('should search content', async ({ request }) => {
    const res = await request.get('http://localhost:3129/api/search?q=Test&type=article', {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.results || body.docs).toBeTruthy()
  })

  test('should list content types', async ({ request }) => {
    const res = await request.get('http://localhost:3129/api/content-types', {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('types')
    expect(body.types.length).toBeGreaterThan(5)
    const names = body.types.map(t => t.name)
    expect(names).toContain('article')
    expect(names).toContain('user')
  })

  test('should return health check OK', async ({ request }) => {
    const res = await request.get('http://localhost:3129/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
