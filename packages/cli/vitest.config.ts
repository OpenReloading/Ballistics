import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // process entry and the schema file writer, run as processes by npm
      exclude: ['src/bin.ts', 'src/write-json-schema.ts'],
      reporter: ['text-summary', 'text'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 96, branches: 91, functions: 97, lines: 97 },
    },
  },
})
