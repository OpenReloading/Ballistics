import path from 'node:path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import webPackage from '../web/package.json' with { type: 'json' }
import { shortCommit } from '../web/scripts/git-head.ts'
import { buildLine, buildTag } from '../web/src/lib/build-line.ts'

const next = process.env.VITE_EDITION === 'next'
const platform = (file: string) => path.resolve(import.meta.dirname, 'src/platform', file)

// next.config.ts `env`, and the NEXT_PUBLIC_* values a Pages build takes from its environment
const build = {
  edition: next ? 'next' : process.env.CI ? 'release' : 'development',
  version: webPackage.version,
  commit: shortCommit(path.join(import.meta.dirname, '../..')),
  day: new Date().toISOString().slice(0, 10),
}
const env: Record<string, string | undefined> = {
  NEXT_PUBLIC_PAGES_BASE_PATH: next ? '/next' : '',
  NEXT_PUBLIC_PAGES_EDITION: next ? 'next' : '',
  NEXT_PUBLIC_BUILD_LINE: buildLine(build as never),
  NEXT_PUBLIC_BUILD_TAG: buildTag(build as never),
  NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  NEXT_PUBLIC_NO_DOCS: process.env.NEXT_PUBLIC_NO_DOCS,
  NEXT_PUBLIC_REPOSITORY_URL: process.env.NEXT_PUBLIC_REPOSITORY_URL,
}

// the six routes of S11; `/` through a query, as the shell takes `/` (TanStack/router#8741)
const pages = [
  '/bullets/',
  '/powders/demo-powder-dp40/',
  '/bullets/designer/',
  '/firearms/',
  '/workbench/',
]

export default defineConfig({
  base: next ? '/next/' : '/',
  define: Object.fromEntries(
    Object.entries(env).map(([k, v]) => [
      `process.env.${k}`,
      v === undefined ? 'undefined' : JSON.stringify(v),
    ]),
  ),
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: platform('link.tsx') },
      { find: /^next\/navigation$/, replacement: platform('navigation.ts') },
      { find: /^next\/dynamic$/, replacement: platform('dynamic.tsx') },
      { find: /^next\/image$/, replacement: platform('image.tsx') },
      { find: /^.*\/app\/fonts\/ui\.ts$/, replacement: platform('font-ui.ts') },
      { find: /^.*\/app\/fonts\/drawing\.ts$/, replacement: platform('font-drawing.ts') },
      { find: /^(\.\/|.*\/lib\/)user-db\.ts$/, replacement: platform('user-db-dexie.ts') },
    ],
  },
  build: { manifest: true },
  worker: { format: 'es' },
  plugins: [
    tanstackStart({
      // the restored S1 to S3 record route is not part of S11
      router: { routeFileIgnorePattern: '\\$kind' },
      spa: { enabled: true },
      prerender: {
        enabled: true,
        crawlLinks: false,
        failOnError: true,
        autoStaticPathsDiscovery: false,
      },
      pages: [
        { path: '/?root', prerender: { onSuccess: () => ({ path: '/' }) } },
        ...pages.map((path) => ({ path })),
      ],
      sitemap: { enabled: true, host: `https://openreloading.github.io${next ? '/next' : ''}` },
    }),
    viteReact(),
    {
      // the modules of each client chunk, for scripts/weigh.ts to name the chunks of a package (the manifest has no module list)
      name: 'chunk-modules',
      generateBundle(_, bundle) {
        if (this.environment.name !== 'client') return
        const chunks = Object.values(bundle).flatMap((c) =>
          c.type === 'chunk' ? [[c.fileName, c.moduleIds]] : [],
        )
        this.emitFile({
          type: 'asset',
          fileName: '.vite/chunk-modules.json',
          source: JSON.stringify(Object.fromEntries(chunks)),
        })
      },
    },
  ],
})
