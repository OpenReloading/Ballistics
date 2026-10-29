import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // build and validation scripts, run as processes by npm
      exclude: ['src/build.ts', 'src/validate.ts'],
      reporter: ['text-summary', 'lcov'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 98, branches: 95, functions: 99, lines: 98 },
    },
  },
})
