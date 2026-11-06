import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 97, branches: 94, functions: 98, lines: 98 },
    },
  },
})
