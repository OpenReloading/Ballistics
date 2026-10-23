import { defineConfig, devices } from '@playwright/test'
import { firstRunDone, safetyAck } from './tests/web/nav.ts'

const webUrl = process.env.WEB_URL ?? 'http://localhost:3001'
/** The Pages site (`npm run pages:serve`), with its base path and a trailing slash. Unset: no project `pages`. */
const pagesUrl = process.env.PAGES_URL

const browserAt = (url: string) => ({
  ...devices['Desktop Chrome'],
  baseURL: url,
  // the offline layer's worker would answer requests from its caches
  serviceWorkers: 'block' as const,
  // the Safety dialog accepted and the first-run step finished, as after a first visit
  // (safety-dialog.tsx, first-run-dialog.tsx); safety.spec.ts and first-run.spec.ts start without
  storageState: {
    cookies: [],
    origins: [
      {
        origin: new URL(url).origin,
        localStorage: [
          { name: 'safety-ack', value: safetyAck },
          { name: 'first-run-done', value: firstRunDone },
        ],
      },
    ],
  },
})

export default defineConfig({
  testDir: './tests',
  // every test has its own browser context: the tests of one file run on several workers
  fullyParallel: true,
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
  ],
})
