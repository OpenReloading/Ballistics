import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 98, branches: 95, functions: 99, lines: 98 },
    },
  },
})
