/**
 * Builds the Pages site into `pages/` at the repository root (apps/web/AGENTS.md, Static site): the web app
 * as a static export under `PAGES_BASE_PATH` (`''`, the site root, when unset), every record page prerendered from the API over the
 * catalogue built from the data bundle (`@open-reloading/api/static`), the catalogue index and the
 * records as data files under `api/`, the docs site under `docs/`, LICENSE, NOTICE, the data
 * license (`data/LICENSE`) and `.nojekyll`.
 * `PAGES_EDITION` is `stable` (default) or `next`: `next` is built to be served under `<base>/next`, the app's
 * base path then, and its browser store (database, local storage keys, caches) has names of its own, because
 * both editions share one origin.
 * `PAGES_URL` (the site's origin) sets the docs' `url` and the app's `metadataBase`. Needs
 * `npm run build` at the root first.
 * `--sample`: only the cartridge pages of `apps/web/src/lib/prerender-sample.ts` prerendered (the
 * data files stay complete) and no docs site, for the review and e2e loop.
 * `--no-docs`: no docs site, every record prerendered (the e2e job's full export).
 * `apps/web/.next` stays after the build: the Turbopack cache a CI run restores and the manifests
 * `check-weight` reads.
 */
import { spawn } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { executable } from './executable.ts'
import { dropFullPayloads } from './pages-payload.ts'

const siteBase = process.env.PAGES_BASE_PATH ?? ''
// Next's basePath: empty, or a path that starts with a slash and does not end in one
if (!/^(\/[^/]+)*$/.test(siteBase))
  throw new Error('PAGES_BASE_PATH must be "" or a path such as /Ballistics')
const edition = process.env.PAGES_EDITION ?? 'stable'
if (edition !== 'stable' && edition !== 'next')
  throw new Error('PAGES_EDITION must be "stable" or "next"')
// the path of this edition's app: the site root's (`PAGES_BASE_PATH`) for stable, `/next` below it for next
const base = edition === 'next' ? `${siteBase}/next` : siteBase

const sample = process.argv.includes('--sample')
const docs = !sample && !process.argv.includes('--no-docs')
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

// the data files of `npm run dev:static` would end in the export beside the ones written below
rmSync(at('apps/web/public/api'), { recursive: true, force: true })
const api = await startBundleApi()
try {
  // never the inherited value: the dev container sets `sample`, which leaves record pages out of the export
  await run(['run', 'build', '-w', '@open-reloading/web'], {
    API_URL: api.url,
    PRERENDER: sample ? 'sample' : 'full',
    PAGES_BASE_PATH: base,
    PAGES_EDITION: edition,
    // no docs site: no Docs link to a 404
    NEXT_PUBLIC_NO_DOCS: docs ? undefined : '1',
  })
  rmSync(site, { recursive: true, force: true })
  cpSync(at('apps/web/out'), site, { recursive: true })
  dropFullPayloads(site)
  await writeStaticApi(api.data, `${site}/api`)
} finally {
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
if (docs)
  await run(
    ['run', 'site:build', '-w', '@open-reloading/docs', '--', '--out-dir', `${site}/docs`],
    {
      ...docsEnv,
      ...(process.env.PAGES_URL && { DOCS_URL: process.env.PAGES_URL }),
    },
  )
for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}/${file}`)
cpSync(at('packages/data/LICENSE'), `${site}/data/LICENSE`)
// GitHub Pages serves the files as they are, `_next/` among them, without Jekyll
writeFileSync(`${site}/.nojekyll`, '')
console.log(`pages/: the Pages site under ${base || '/'}`)
