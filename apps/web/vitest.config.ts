import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // the same name tsconfig `paths` gives Next
    alias: { '@/platform': fileURLToPath(new URL('./src/platform', import.meta.url)) },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Next.js route entry files (pages, layouts, error boundaries, manifest, fonts) run only in a Next.js build
        'src/app/**',
        // the font loaders run only in a Next.js build
        'src/platform/fonts/**',
        // worker entries run in a Worker, which is not instrumented
        'src/**/*.worker.ts',
      ],
      reporter: ['text-summary'],
    },
  },
})
