import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './e2e', use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000', screenshot: 'only-on-failure' }, retries: process.env.CI ? 1 : 0 })
