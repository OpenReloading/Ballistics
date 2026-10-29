import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 96, branches: 93, functions: 98, lines: 97 },
    },
  },
})
