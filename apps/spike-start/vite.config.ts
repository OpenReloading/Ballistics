import { readFileSync } from 'node:fs'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const next = process.env.VITE_EDITION === 'next'
const records: string[] = JSON.parse(readFileSync('generated/prerender.json', 'utf8'))
// PRERENDER=sample: three records per language test, the rest left to 404.html; otherwise the whole public catalog
const sample = [
  '/cartridges/308-win/',
  '/bullets/demo-bullet-150/',
  '/disciplines/bdmp-1500-carbine/',
]
const pages = process.env.PRERENDER === 'sample' ? sample : records

export default defineConfig({
  base: next ? '/next/' : '/',
  plugins: [
    tanstackStart({
      spa: { enabled: true },
      prerender: {
        enabled: true,
        crawlLinks: false,
        failOnError: true,
        autoStaticPathsDiscovery: false,
      },
      pages: [
        // the shell takes `/` (TanStack/router#8741): a query gives the home page its own entry, written to
        // index.html, and onSuccess puts `/` back for the sitemap
        { path: '/?root', prerender: { onSuccess: () => ({ path: '/' }) } },
        { path: '/workbench/' },
        { path: '/grid/' },
        ...pages.map((path) => ({ path })),
      ],
      sitemap: { enabled: true, host: `https://openreloading.github.io${next ? '/next' : ''}` },
    }),
    viteReact(),
  ],
})
