// E2E test helpers — shared setup and utilities for Playwright tests

const BASE = 'http://localhost:3129'

/**
 * Register a test user via API and return credentials + token.
 * Uses a unique username to avoid collisions across test runs.
 */
export async function registerTestUser(request, suffix = '') {
  const ts = Date.now()
  const username = `e2euser${suffix}_${ts}`
  const password = 'E2eTestPass123!'

  const res = await request.post(`${BASE}/api/auth/register`, {
    data: { username, password, email: `${username}@test.local` },
  })
  const body = await res.json()

  if (res.status() !== 201) {
    throw new Error(`Register failed: ${res.status()} ${JSON.stringify(body)}`)
  }

  return { username, password, token: body.token, userId: body.user?.id }
}

/**
 * Log into the admin UI via localStorage injection.
 * Sets the token before page load so the auth store picks it up.
 */
export async function loginViaStorage(page, token, user) {
  // Set token before navigating — auth store reads localStorage at init
  await page.addInitScript((t) => {
    localStorage.setItem('taichu_token', t)
  }, token)
  await page.goto('/admin/')
  await page.waitForTimeout(1000)
}

/**
 * Create an article via API for cleanup-safe testing.
 */
export async function createArticle(request, token, data = {}) {
  const res = await request.post(`${BASE}/api/content/article`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      data: {
        title: data.title || 'E2E Test Article',
        slug: data.slug || `e2e-test-${Date.now()}`,
        body: JSON.stringify({ content: data.content || 'Test content for E2E.' }),
        excerpt: data.excerpt || 'Test excerpt',
        ...data,
      },
      status: 'draft',
    },
  })
  const body = await res.json()
  if (res.status() !== 201) {
    throw new Error(`Create article failed: ${res.status()} ${JSON.stringify(body)}`)
  }
  return body
}

/**
 * Delete an article via API for cleanup.
 */
export async function deleteArticle(request, token, id) {
  await request.delete(`${BASE}/api/content/article/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}
