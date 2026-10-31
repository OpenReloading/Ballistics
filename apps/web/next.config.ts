import os from 'node:os'
import path from 'node:path'
import type { NextConfig } from 'next'
import packageJson from './package.json' with { type: 'json' }
import { shortCommit } from './scripts/git-head.ts'
import { buildLine } from './src/lib/build-line.ts'

/**
 * The static export, served under this path (`''` at a domain root, `/Ballistics` on a project
 * site). Its data files and compute run in the browser.
 */
const basePath = process.env.PAGES_BASE_PATH ?? ''

const edition = process.env.PAGES_EDITION === 'next' ? 'next' : ''

// the checkout's own commit: a release edition builds from its tag, not from the commit that started the run
const commit = shortCommit(path.join(import.meta.dirname, '../..'))

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // every page as <path>/index.html, so a static host needs no rule for `x.html` beside `x/`
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_PAGES_BASE_PATH: basePath,
    NEXT_PUBLIC_PAGES_EDITION: edition,
    NEXT_PUBLIC_BUILD_LINE: buildLine({
      // a Pages build runs in CI (`CI` set there); anything else is a local build
      edition: edition || (process.env.CI ? 'release' : 'development'),
      version: packageJson.version,
      commit,
      day: new Date().toISOString().slice(0, 10),
    }),
  },
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // the images are two SVG logos, served as files: no optimizer, so the image needs no sharp
  images: { unoptimized: true },
  experimental: {
    // `'use cache'` of `src/lib/api.ts` without Cache Components
    useCache: true,
    // static generation workers, 8 at most. Full build, 15 workers: 149 to 192 s, peak 11.5 to 14.5 cores, 6.3 GB;
    // 8 workers: 186 to 190 s, peak 10.5 cores, 4.3 GB (shared host, load varied). BUILD_WORKERS=<n> for another number
    cpus: Math.min(os.availableParallelism() - 1, Number(process.env.BUILD_WORKERS) || 8),
  },
}

export default nextConfig
