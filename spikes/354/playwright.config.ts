// biome-ignore-all lint/correctness/noUndeclaredDependencies: spike, run with the e2e workspace's Playwright
import { defineConfig, devices } from '@playwright/test'
import { safetyAck } from '../../apps/e2e/tests/web/nav.ts'

const webUrl = process.env.WEB_URL ?? 'http://localhost:3003'

// spike only: the timing and prototype specs of the auto-run and undo study, one worker so runs do not compete
export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 600_000,
  reporter: 'list',
  projects: [
    {
      name: 'spike',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        baseURL: webUrl,
        serviceWorkers: 'block',
        storageState: {
          cookies: [],
          origins: [
            {
              origin: new URL(webUrl).origin,
              localStorage: [{ name: 'safety-ack', value: safetyAck }],
            },
          ],
        },
      },
    },
  ],
})
