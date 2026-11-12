import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  outputDir: process.env.PW_OUT ?? 'test-results',
  reporter: [['list']],
  workers: 4,
  use: { baseURL: 'http://localhost:3043' },
  webServer: { command: 'node scripts/serve.ts', port: 3043, reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
