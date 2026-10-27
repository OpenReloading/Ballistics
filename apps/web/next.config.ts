import os from 'node:os'
import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Set, the Pages edition: a static export served under this path (`''` at a domain root), its data
 * files and compute in the browser (README, Pages edition). Next 16.4 exports only without Cache
 * Components, so the server edition's `*.server.ts(x)` route files (the forwarding route, the
 * record pages' `ensureStatic`) are left out of it by `pageExtensions`.
 */
const pagesBasePath = process.env.PAGES_BASE_PATH
const pages = pagesBasePath !== undefined

const nextConfig: NextConfig = {
  cacheComponents: !pages,
  partialPrefetching: !pages,
  output: pages ? 'export' : 'standalone',
  pageExtensions: pages ? ['tsx', 'ts'] : ['server.tsx', 'server.ts', 'tsx', 'ts'],
  ...(pages && {
    basePath: pagesBasePath,
    // every page as <path>/index.html, so a static host needs no rule for `x.html` beside `x/`
    trailingSlash: true,
    env: {
      NEXT_PUBLIC_PAGES_BASE_PATH: pagesBasePath,
      NEXT_PUBLIC_PAGES_EDITION: process.env.PAGES_EDITION === 'next' ? 'next' : '',
    },
  }),
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // the images are two SVG logos, served as files: no optimizer, so the image needs no sharp
  images: { unoptimized: true },
  experimental: {
    // `'use cache'` of `src/lib/api.ts` without Cache Components
    ...(pages && { useCache: true }),
    // static generation workers, 8 at most. Full build, 15 workers: 149 to 192 s, peak 11.5 to 14.5 cores, 6.3 GB;
    // 8 workers: 186 to 190 s, peak 10.5 cores, 4.3 GB (shared host, load varied). BUILD_WORKERS=<n> for another number
    cpus: Math.min(os.availableParallelism() - 1, Number(process.env.BUILD_WORKERS) || 8),
  },
  // keeps the Pages edition's data file reader and compute worker out of the server edition's chunks
  ...(!pages && {
    turbopack: { resolveAlias: { './static-api.ts': './src/lib/no-static-api.ts' } },
  }),
}

export default nextConfig
