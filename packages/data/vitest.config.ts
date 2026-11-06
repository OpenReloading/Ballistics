import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // build and validation scripts, run as processes by pnpm
      exclude: ['src/build.ts', 'src/validate.ts'],
      reporter: ['text-summary'],
    },
  },
})
