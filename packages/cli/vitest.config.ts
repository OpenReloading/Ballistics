import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // process entry and the schema file writer, run as processes by npm
      exclude: ['src/bin.ts', 'src/write-json-schema.ts'],
      reporter: ['text-summary', 'text', 'lcov'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 97, branches: 93, functions: 98, lines: 97 },
    },
  },
})
