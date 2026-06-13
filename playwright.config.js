import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3129',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node packages/server/src/index.js',
    url: 'http://localhost:3129/api/health',
    reuseExistingServer: true,
    timeout: 15000,
    env: {
      TAICHU_PORT: '3129',
      TAICHU_JWT_SECRET: 'e2e-test-secret-do-not-use-in-production',
    },
    cwd: '.',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
