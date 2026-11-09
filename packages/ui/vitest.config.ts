import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import type { BrowserInstanceOption } from 'vitest/node'

const configDir = fileURLToPath(new URL('.storybook', import.meta.url))

/** The browsers a story runs in; `touch` is a phone with a coarse pointer, under WebKit as well (spike S8). */
const browsers = {
  light: { browser: 'chromium', contextOptions: { colorScheme: 'light' } },
  dark: { browser: 'chromium', contextOptions: { colorScheme: 'dark' } },
  forced: { browser: 'chromium', contextOptions: { forcedColors: 'active' } },
  touch: { browser: 'webkit', contextOptions: { hasTouch: true, isMobile: true } },
} as const

/** Every story runs as a test, axe included, in a project per width: Storybook sizes each story's frame from its viewport (1200 px by default), so the width reaches the stories as `__STORY_WIDTH__` (.storybook/preview.tsx). */
const stories = (width: number, schemes: (keyof typeof browsers)[]) => ({
  plugins: [storybookTest({ configDir })],
  define: { __STORY_WIDTH__: String(width) },
  test: {
    name: `stories-${width}`,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: schemes.map(
        (scheme): BrowserInstanceOption => ({
          browser: browsers[scheme].browser,
          name: `${scheme}-${width}`,
          provider: playwright({ contextOptions: browsers[scheme].contextOptions }),
        }),
      ),
    },
  },
})

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['test/**/*.test.{ts,tsx}'], environment: 'node' } },
      stories(320, ['light']),
      stories(390, ['light', 'dark', 'forced', 'touch']),
      stories(1280, ['light']),
    ],
  },
})
