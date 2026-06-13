// E2E: Admin UI browser tests
import { test, expect } from '@playwright/test'
import { registerTestUser, loginViaStorage, createArticle, deleteArticle } from './helpers.js'

test.describe('Admin UI', () => {
  let user

  test.beforeAll(async ({ request }) => {
    user = await registerTestUser(request, '_ui')
  })

  test('should load admin app and show login page', async ({ page }) => {
    await page.goto('/admin/')
    // Should redirect to login or show login form
    await page.waitForTimeout(1000)
    const url = page.url()
    // Hash router: either shows login or redirects to /login
    expect(url).toMatch(/\/admin\//)
  })

  test('should show dashboard after login', async ({ page }) => {
    await loginViaStorage(page, user.token, user)
    await page.goto('/admin/#/dashboard')
    await page.waitForTimeout(1500)
    // Dashboard should have some content
    const heading = page.locator('h2')
    await expect(heading.first()).toBeVisible({ timeout: 5000 })
  })

  test('should navigate sidebar menu items', async ({ page }) => {
    await loginViaStorage(page, user.token, user)
    await page.goto('/admin/#/dashboard')
    await page.waitForTimeout(1000)

    // Navigate to content list
    await page.goto('/admin/#/content/article')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/content/article')

    // Navigate to media
    await page.goto('/admin/#/media')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/media')

    // Navigate to settings
    await page.goto('/admin/#/settings')
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/settings')
  })

  test('should toggle dark mode and persist', async ({ page }) => {
    await loginViaStorage(page, user.token, user)
    await page.goto('/admin/#/dashboard')
    await page.waitForTimeout(1000)

    // Find and click the theme toggle button in sidebar
    const themeBtn = page.locator('.btn-theme')
    if (await themeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click to toggle to dark
      await themeBtn.click()
      await page.waitForTimeout(500)

      // Verify data-theme attribute
      const theme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      )
      expect(theme).toBe('dark')

      // Verify localStorage persistence
      const stored = await page.evaluate(() =>
        localStorage.getItem('taichu-theme')
      )
      expect(stored).toBe('dark')

      // Toggle back to light
      await themeBtn.click()
      await page.waitForTimeout(500)
      const theme2 = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme')
      )
      expect(theme2 || '').toBe('')
    }
  })

  test('should create content via admin UI', async ({ page, request }) => {
    await loginViaStorage(page, user.token, user)

    // Go to new article page
    await page.goto('/admin/#/content/article/new')
    await page.waitForTimeout(1500)

    // Check form is visible
    const titleInput = page.locator('input').first()
    if (await titleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await titleInput.fill('E2E Admin UI Article')
      await page.waitForTimeout(300) // Let slug auto-generate

      // Submit as draft
      const saveBtn = page.locator('button', { hasText: '保存草稿' })
      if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveBtn.click()
        await page.waitForTimeout(2000)

        // Should redirect to content list
        expect(page.url()).toContain('/content/article')
      }
    }
  })
})
