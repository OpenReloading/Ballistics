import { defineConfig, devices } from '@playwright/test'
import { safetyAck } from './tests/web/nav.ts'

const webUrl = process.env.WEB_URL ?? 'http://localhost:3003'
/** The Pages site (`pnpm run pages:serve`), with its base path and a trailing slash. Unset: no project `pages`. */
const pagesUrl = process.env.PAGES_URL
/** Set: projects `firefox` and `webkit` run the smoke spec against `WEB_URL`. */
const allEngines = Boolean(process.env.ALL_ENGINES)
/** `off`: no Start site build and no projects `start-*` (the drawing baseline, a local `--project full` run). */
const startSite = process.env.START_SITE !== 'off'
const startUrl = 'http://localhost:3043/Ballistics/'
/** A site with both editions as `pages.yml` deploys it, with its base path and a trailing slash. Unset: the export at `WEB_URL`, whose root `404.html` is the same page. */
const editionsUrl = process.env.EDITIONS_URL ?? webUrl.replace(/\/?$/, '/')

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
  // a `test.only` or `describe.only` left in a spec fails the CI run instead of skipping the rest
  forbidOnly: !!process.env.CI,
  // on GitHub Actions the default `dot` plus annotations, so a failed test shows on the pull request without the job log
  ...(process.env.GITHUB_ACTIONS && { reporter: [['dot'], ['github']] }),
  // the default without {-projectName}: a renamed project still finds the committed snapshots
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}',
  // both Start editions as one Pages site under a project-site base path, built once per run
  webServer: startSite
    ? [
        {
          command: 'node ../../tools/src/start-site.ts --sample --serve',
          url: startUrl,
          env: {
            PAGES_BASE_PATH: '/Ballistics',
            PAGES_URL: 'https://openreloading.github.io',
            PORT: '3043',
          },
          // the build's output and client sizes show in the job log
          stdout: 'pipe',
          timeout: 180_000,
          reuseExistingServer: !process.env.CI,
        },
      ]
    : [],
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
    ...(startSite
      ? (
          [
            ['start-chromium', devices['Desktop Chrome']],
            ['start-firefox', devices['Desktop Firefox']],
            ['start-webkit', devices['Desktop Safari']],
          ] as const
        ).map(([name, device]) => ({
          name,
          testDir: './tests/start',
          use: { ...device, baseURL: startUrl },
        }))
      : []),
    ...(
      [
        ['editions-chromium', devices['Desktop Chrome']],
        ['editions-firefox', devices['Desktop Firefox']],
        ['editions-webkit', devices['Desktop Safari']],
      ] as const
    ).map(([name, device]) => ({
      name,
      testDir: './tests/editions',
      // the root 404.html also answers below the stable edition's worker
      use: { ...browserAt(editionsUrl, device), serviceWorkers: 'allow' as const },
    })),
  ],
})
