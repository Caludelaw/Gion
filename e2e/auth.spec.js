// E2E: Authentication flow tests
import { test, expect } from '@playwright/test'
import { registerTestUser } from './helpers.js'

test.describe('Authentication', () => {
  test('should register a new user via API', async ({ request }) => {
    const user = await registerTestUser(request, '_reg')
    expect(user.token).toBeTruthy()
    expect(user.username).toContain('e2euser')
  })

  test('should reject login with wrong password', async ({ request }) => {
    const user = await registerTestUser(request, '_badlogin')
    const res = await request.post('http://localhost:3129/api/auth/login', {
      data: { username: user.username, password: 'WrongPassword!' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('UNAUTHORIZED')
  })

  test('should login successfully via API', async ({ request }) => {
    const user = await registerTestUser(request, '_login')
    const res = await request.post('http://localhost:3129/api/auth/login', {
      data: { username: user.username, password: user.password },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.username).toBe(user.username)
  })

  test('should reject API requests without auth', async ({ request }) => {
    const res = await request.get('http://localhost:3129/api/content/article')
    expect(res.status()).toBe(401)
  })

  test('should accept API requests with valid JWT', async ({ request }) => {
    const user = await registerTestUser(request, '_jwt')
    const res = await request.get('http://localhost:3129/api/content/article', {
      headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('docs')
    expect(body).toHaveProperty('total')
  })
})
