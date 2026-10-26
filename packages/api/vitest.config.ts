import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // process entry, build step and the worker thread entry (a worker is not instrumented)
        'src/server.ts',
        'src/catalogue/write.ts',
        'src/compute/worker.ts',
      ],
      reporter: ['text-summary'],
      // floors: the measured value rounded down, minus one
      thresholds: { statements: 97, branches: 92, functions: 97, lines: 97 },
    },
  },
})
