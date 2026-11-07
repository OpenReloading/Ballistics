import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/** Every story runs as a test, axe included, at three widths in the light, dark and forced-colors schemes. */
const schemes = {
  light: { colorScheme: 'light' },
  dark: { colorScheme: 'dark' },
  forced: { forcedColors: 'active' },
} as const
const widths = [320, 390, 1280]

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['test/**/*.test.tsx'], environment: 'node' } },
      {
        plugins: [
          storybookTest({ configDir: fileURLToPath(new URL('.storybook', import.meta.url)) }),
        ],
        test: {
          name: 'stories',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              ...Object.entries(schemes).flatMap(([scheme, contextOptions]) =>
                widths.map((width) => ({
                  browser: 'chromium' as const,
                  name: `${scheme}-${width}`,
                  viewport: { width, height: 900 },
                  provider: playwright({ contextOptions }),
                })),
              ),
              // a phone with touch: a coarse pointer, under WebKit as well (spike S8)
              {
                browser: 'webkit',
                name: 'webkit-touch-390',
                viewport: { width: 390, height: 900 },
                provider: playwright({ contextOptions: { hasTouch: true, isMobile: true } }),
              },
            ],
          },
        },
      },
    ],
  },
})
