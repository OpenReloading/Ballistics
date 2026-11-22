import { readFileSync } from 'node:fs'
import path from 'node:path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { staticPaths } from './src/routes/-static-paths.ts'

export default defineConfig(({ command }) => {
  // the edition's own path, as next.config.ts reads it: /Ballistics/next for next on the project site
  const base = process.env.PAGES_BASE_PATH ?? ''
  const edition = process.env.PAGES_EDITION === 'next' ? 'next' : ''
  const site = process.env.PAGES_URL
  // written by scripts/prerender-list.mts; the dev server renders any path and needs no list
  const records: string[] =
    command === 'build'
      ? JSON.parse(readFileSync(path.join(import.meta.dirname, 'dist/prerender.json'), 'utf8'))
      : []
  // the literals of src/platform/edition.ts and the site's origin: the browser has no process.env
  const values = {
    NEXT_PUBLIC_PAGES_BASE_PATH: base,
    NEXT_PUBLIC_PAGES_EDITION: edition,
    NEXT_PUBLIC_BUILD_LINE: undefined,
    NEXT_PUBLIC_BUILD_TAG: undefined,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
    NEXT_PUBLIC_NO_DOCS: process.env.NEXT_PUBLIC_NO_DOCS,
    NEXT_PUBLIC_REPOSITORY_URL: process.env.NEXT_PUBLIC_REPOSITORY_URL,
    PAGES_URL: site,
  }
  return {
    base: `${base}/`,
    define: Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        `process.env.${name}`,
        value === undefined ? 'undefined' : JSON.stringify(value),
      ]),
    ),
    resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
    // Start's prerender imports server.js; Vite names it .mjs in a package without "type": "module"
    environments: {
      ssr: { build: { rolldownOptions: { output: { entryFileNames: '[name].js' } } } },
    },
    plugins: [
      tanstackStart({
        // no link's path, so the shell marks none as the current page
        spa: { enabled: true, maskPath: '/_shell' },
        prerender: {
          enabled: true,
          crawlLinks: false,
          failOnError: true,
          autoStaticPathsDiscovery: false,
        },
        pages: [
          // the shell takes `/`, so a query gives home its own entry until TanStack/router#8741 closes
          { path: '/?root', prerender: { onSuccess: () => ({ path: '/' }) } },
          ...[...staticPaths, ...records].map((page) => ({ path: page })),
        ],
        // a sitemap holds absolute addresses, which need the site's origin
        sitemap: site ? { enabled: true, host: `${site}${base}` } : { enabled: false },
      }),
      viteReact(),
    ],
  }
})
