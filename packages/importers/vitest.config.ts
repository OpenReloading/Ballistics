import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 95, branches: 90, functions: 98, lines: 97 },
    },
  },
})
