/**
 * Builds the Pages site into `pages/` at the repository root (README, Pages edition): the web app
 * as a static export under `PAGES_BASE_PATH`, every record page prerendered from the API over the
 * catalogue built from the data bundle (`@open-reloading/api/static`), the catalogue index and the
 * records as data files under `api/`, the docs site under `docs/`, LICENSE, NOTICE, the data
 * license (`data/LICENSE`) and `.nojekyll`.
 * `PAGES_EDITION` is `stable` (default) or `next`: `next` is built to be served under `<base>/next`, the app's
 * base path then, and its browser store (database, local storage keys, caches) has names of its own, because
 * both editions share one origin.
 * `PAGES_URL` (the site's origin) sets the docs' `url` and the app's `metadataBase`. Needs
 * `npm run build` at the root first.
 */
import { spawn } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { executable } from './executable.ts'
import { dropFullPayloads } from './pages-payload.ts'

const siteBase = process.env.PAGES_BASE_PATH
// Next's basePath: empty, or a path that starts with a slash and does not end in one
if (siteBase === undefined || !/^(\/[^/]+)*$/.test(siteBase))
  throw new Error('PAGES_BASE_PATH must be set: "" or a path such as /Ballistics')
const edition = process.env.PAGES_EDITION ?? 'stable'
if (edition !== 'stable' && edition !== 'next')
  throw new Error('PAGES_EDITION must be "stable" or "next"')
// the path of this edition's app: the site root's (`PAGES_BASE_PATH`) for stable, `/next` below it for next
const base = edition === 'next' ? `${siteBase}/next` : siteBase

const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const site = at('pages')

/** Runs npm without blocking this process: the build reads the API it serves. */
function run(args: string[], env: Record<string, string | undefined>) {
  return new Promise<void>((resolve, reject) => {
    spawn(executable('npm'), args, {
      cwd: at(''),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
      .on('error', reject)
      .on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed`)),
      )
  })
}

// the web app's build directory and Turbopack cache: one edition's cache fails the other's build
const clearWebBuild = () => rmSync(at('apps/web/.next'), { recursive: true, force: true })
const api = await startBundleApi()
clearWebBuild()
try {
  // `full`: the dev container sets `sample`, and an export has no page it did not prerender
  await run(['run', 'build', '-w', '@open-reloading/web'], {
    API_URL: api.url,
    PRERENDER: 'full',
    PAGES_BASE_PATH: base,
    PAGES_EDITION: edition,
  })
  rmSync(site, { recursive: true, force: true })
  cpSync(at('apps/web/out'), site, { recursive: true })
  dropFullPayloads(site)
  await writeStaticApi(api.data, `${site}/api`)
} finally {
  clearWebBuild()
  await api.close()
}
// no API on the Pages site: the docs' REST page has no link to one
const docsEnv = {
  DOCS_BASE_URL: `${base}/docs/`,
  APP_URL: process.env.PAGES_URL && `${process.env.PAGES_URL}${base}/`,
  API_URL: undefined,
  PAGES_BASE_PATH: undefined,
  PAGES_EDITION: undefined,
}
await run(['run', 'site:build', '-w', '@open-reloading/docs', '--', '--out-dir', `${site}/docs`], {
  ...docsEnv,
  ...(process.env.PAGES_URL && { DOCS_URL: process.env.PAGES_URL }),
})
for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}/${file}`)
cpSync(at('packages/data/LICENSE'), `${site}/data/LICENSE`)
// GitHub Pages serves the files as they are, `_next/` among them, without Jekyll
writeFileSync(`${site}/.nojekyll`, '')
console.log(`pages/: the Pages site under ${base || '/'}`)
