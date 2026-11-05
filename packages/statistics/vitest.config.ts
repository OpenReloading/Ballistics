import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      // floors: the measured value rounded down, minus one; the continued fraction's underflow
      // guards and the NaN fallbacks of the eigenvalue reads are not reached
      thresholds: { statements: 98, branches: 93, functions: 99, lines: 99 },
    },
  },
})
