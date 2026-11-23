// Builds both Start editions into one Pages-shaped site in `pages-start/`; settings and flags: apps/docs/docs/release.md#pages-site
import { execFileSync } from 'node:child_process'
import { cpSync, globSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { serve } from './pages-serve.ts'
import { rootNotFound } from './root-not-found.ts'

const siteBase = process.env.PAGES_BASE_PATH ?? ''
// the check of pages.ts: empty, or a path that starts with a slash and does not end in one
if (!/^(\/[^/]+)*$/.test(siteBase))
  throw new Error('PAGES_BASE_PATH must be "" or a path such as /Ballistics')
const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const site = at('pages-start/')
const web = at('apps/web/')

/** Runs a binary of the web app's install, not through pnpm, which the Playwright image lacks. */
function run(file: string, args: string[], env: Record<string, string | undefined> = {}) {
  execFileSync(file, args, { cwd: web, env: { ...process.env, ...env }, stdio: 'inherit' })
}

function build() {
  // never the inherited value: the dev container sets `sample`
  const prerender = process.argv.includes('--sample') ? 'sample' : 'full'
  // writes the data files into public/, which Vite copies into each edition's api/, and the record list
  run(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/prerender-list.mts'],
    { PRERENDER: prerender },
  )
  run(`${web}node_modules/.bin/lingui`, ['compile', '--strict'])
  rmSync(site, { recursive: true, force: true })
  for (const edition of ['stable', 'next'] as const) {
    const base = edition === 'next' ? `${siteBase}/next` : siteBase
    run(`${web}node_modules/.bin/vite`, ['build'], {
      PAGES_EDITION: edition,
      PAGES_BASE_PATH: base,
      PRERENDER: prerender,
      NODE_ENV: 'development',
    })
    const out = edition === 'next' ? `${site}next/` : site
    // a move, not a copy: a recursive cpSync into the dev container's bind mount fails with EACCES on macOS
    renameSync(`${web}dist/client`, out)
    cpSync(`${out}_shell.html`, `${out}404.edition.html`)
    // no budget gate yet: the log shows the client's weight per edition
    const bytes = globSync('assets/**', { cwd: out })
      .map((file) => statSync(`${out}${file}`))
      .filter((stat) => stat.isFile())
      .reduce((sum, stat) => sum + stat.size, 0)
    console.log(`${edition}: ${base || '/'}, client ${Math.round(bytes / 1024)} KiB`)
  }
  writeFileSync(`${site}404.html`, rootNotFound(siteBase))
  for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}${file}`)
  cpSync(at('packages/catalog/LICENSE'), `${site}data/LICENSE`)
  writeFileSync(`${site}.nojekyll`, '')
}

if (!process.argv.includes('--serve-only')) build()
if (process.argv.includes('--serve') || process.argv.includes('--serve-only')) {
  const port = Number(process.env.PORT ?? 3043)
  createServer(serve(site, siteBase)).listen(port, () =>
    console.log(`pages-start/ on http://localhost:${port}${siteBase}/`),
  )
}
