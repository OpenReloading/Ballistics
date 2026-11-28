import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // the name tsconfig `paths` gives
    alias: { '@/platform': fileURLToPath(new URL('./src/platform', import.meta.url)) },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // worker entries run in a Worker, which is not instrumented
        'src/**/*.worker.ts',
      ],
      reporter: ['text-summary'],
    },
  },
})
