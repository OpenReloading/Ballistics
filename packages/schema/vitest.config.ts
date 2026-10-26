import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // script that writes the JSON Schema files at build time
      exclude: ['src/write-json-schema.ts'],
      reporter: ['text-summary'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 97, branches: 95, functions: 97, lines: 98 },
    },
  },
})
