import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/** Every story runs as a test, axe included: at three widths in the light scheme, and in the dark and forced-colors schemes at 390 px. */
const contexts = [
  ...[320, 390, 1280].map((width) => ({
    name: `light-${width}`,
    width,
    options: { colorScheme: 'light' } as const,
  })),
  { name: 'dark-390', width: 390, options: { colorScheme: 'dark' } },
  { name: 'forced-390', width: 390, options: { forcedColors: 'active' } },
] as const

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
              ...contexts.map(({ name, width, options }) => ({
                browser: 'chromium' as const,
                name,
                viewport: { width, height: 900 },
                provider: playwright({ contextOptions: options }),
              })),
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
