import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // no thresholds: the run feeds the code quality gate
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Next.js route entry files (pages, layouts, error boundaries, manifest, fonts) run only in a Next.js build
        'src/app/**',
        // worker entries run in a Worker, which is not instrumented
        'src/**/*.worker.ts',
      ],
      reporter: ['text-summary', 'lcov'],
    },
  },
})
