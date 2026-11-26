import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { isModelFile } from './src/lib/offline.ts'
import { webManifest } from './src/lib/web-manifest.ts'
import { checkRecordPaths, staticPaths } from './src/routes/-static-paths.ts'

const startBodies: Record<string, string> = {
  'next/dynamic': 'dynamic.tsx',
  'next/font/local': 'local-font.ts',
  'next/image': 'image.tsx',
  'next/link': 'link.tsx',
  'next/navigation': 'navigation.ts',
}

/** The views import these Next modules; the Start build takes the bodies in src/platform/start, and any other Next module fails it. */
const nextSeam: Plugin = {
  name: 'next-seam',
  enforce: 'pre',
  resolveId(id) {
    const body = startBodies[id]
    if (body) return path.join(import.meta.dirname, 'src/platform/start', body)
    if (id === 'next' || id.startsWith('next/')) this.error(`${id} has no body in the Start build`)
    return null
  },
}

/** The web app manifest and the icons it and the root's head name, at the paths the Next export serves them at. */
const appManifest = (basePath: string): Plugin => ({
  name: 'app-manifest',
  applyToEnvironment: (environment) => environment.name === 'client',
  generateBundle() {
    for (const icon of ['icon.png', 'apple-icon.png'])
      this.emitFile({
        type: 'asset',
        fileName: icon,
        source: readFileSync(path.join(import.meta.dirname, 'src/app', icon)),
      })
    const manifest = JSON.stringify(webManifest(basePath))
    this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest })
  },
})

/** Fails a client output that holds a WebAssembly or ONNX file, emitted or copied from public/: the offline layer precaches that output. */
const noModelFiles: Plugin = {
  name: 'no-model-files',
  applyToEnvironment: (environment) => environment.name === 'client',
  writeBundle({ dir }) {
    const found = dir ? globSync('**/*', { cwd: dir }).filter(isModelFile) : []
    if (found.length) this.error(`the client output holds ${found.join(', ')}`)
  },
}

/** The ONNX Runtime Web build that loads its WASM files from `wasmPaths`; the package's default build makes the bundler emit them (src/lib/onnx-model.ts). */
const onnxWasm = 'node_modules/onnxruntime-web/dist/ort.wasm.min.mjs'

export default defineConfig(({ command }) => {
  // the edition's own path, as next.config.ts reads it: /Ballistics/next for next on the project site
  const base = process.env.PAGES_BASE_PATH ?? ''
  const edition = process.env.PAGES_EDITION === 'next' ? 'next' : ''
  const site = process.env.PAGES_URL
  // written by scripts/prerender-list.mts; the dev server renders any path and needs no list
  const records: string[] =
    command === 'build'
      ? checkRecordPaths(
          JSON.parse(readFileSync(path.join(import.meta.dirname, 'dist/prerender.json'), 'utf8')),
        )
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
    resolve: {
      alias: {
        '@': path.join(import.meta.dirname, 'src'),
        'onnxruntime-web/wasm': path.join(import.meta.dirname, onnxWasm),
      },
    },
    // the prerender fetches its preview server: on `localhost` that binds ::1 alone, and a blocked event loop makes fetch fall back to 127.0.0.1
    preview: { host: '127.0.0.1' },
    build: {
      modulePreload: {
        // pages read the in-browser API on mount: preloads of its imports wait for its chunk to run, and WebKit warns about a preload still unused a few seconds after load
        resolveDependencies: (file, deps) =>
          path.basename(file).startsWith('static-api-') ? deps.filter((dep) => dep === file) : deps,
      },
    },
    // Start's prerender imports server.js; Vite names it .mjs in a package without "type": "module"
    environments: {
      ssr: { build: { rolldownOptions: { output: { entryFileNames: '[name].js' } } } },
    },
    plugins: [
      nextSeam,
      appManifest(base),
      noModelFiles,
      tanstackStart({
        // Start preloads every chunk of a route file: a not-found chunk of its own goes unused on a found record, which WebKit warns about
        router: {
          codeSplittingOptions: {
            defaultBehavior: [['component', 'notFoundComponent'], ['errorComponent']],
          },
        },
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
