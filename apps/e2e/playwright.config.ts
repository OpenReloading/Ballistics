import { defineConfig, devices } from '@playwright/test'
import { safetyAck } from './tests/web/nav.ts'

const webUrl = process.env.WEB_URL ?? 'http://localhost:3003'
/** The Pages site (`npm run pages:serve`), with its base path and a trailing slash. Unset: no project `pages`. */
const pagesUrl = process.env.PAGES_URL
/** Set: projects `firefox` and `webkit` run the smoke spec against `WEB_URL`. */
const allEngines = Boolean(process.env.ALL_ENGINES)

const browserAt = (url: string, device = devices['Desktop Chrome']) => ({
  ...device,
  baseURL: url,
  // the offline layer's worker would answer requests from its caches
  serviceWorkers: 'block' as const,
  // the Safety dialog accepted, as after a first visit (safety-dialog.tsx); safety.spec.ts starts without
  storageState: {
    cookies: [],
    origins: [
      {
        origin: new URL(url).origin,
        localStorage: [{ name: 'safety-ack', value: safetyAck }],
      },
    ],
  },
})

export default defineConfig({
  testDir: './tests',
  // every test has its own browser context: the tests of one file run on several workers
  fullyParallel: true,
  // CI: one worker per core (4 on ubuntu-latest) instead of the default half
  workers: process.env.CI ? '100%' : undefined,
  // the default without {-projectName}: a renamed project still finds the committed snapshots
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  projects: [
    {
      name: 'full',
      testDir: './tests/web',
      use: browserAt(webUrl),
    },
    ...(pagesUrl
      ? [
          {
            name: 'pages',
            testDir: './tests/web',
            testMatch: 'smoke.spec.ts',
            use: browserAt(pagesUrl),
          },
        ]
      : []),
    ...(allEngines
      ? [
          {
            name: 'firefox',
            testDir: './tests/web',
            testMatch: 'smoke.spec.ts',
            use: browserAt(webUrl, devices['Desktop Firefox']),
          },
          {
            name: 'webkit',
            testDir: './tests/web',
            testMatch: 'smoke.spec.ts',
            use: browserAt(webUrl, devices['Desktop Safari']),
          },
        ]
      : []),
  ],
})
