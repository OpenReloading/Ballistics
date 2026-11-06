import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 98, branches: 96, functions: 97, lines: 98 },
    },
  },
})
