/**
 * Builds the Pages site into `pages/` at the repository root (README, Pages edition): the web app
 * as a static export under `PAGES_BASE_PATH`, every record page prerendered from the API over the
 * catalogue built from the data bundle (`@open-reloading/api/static`), the catalogue index and the
 * records as data files under `api/`, the docs site under `docs/`, LICENSE, NOTICE, the data
 * license (`data/LICENSE`) and `.nojekyll`.
 * `PAGES_URL` (the site's origin) sets the docs' `url` and the app's `metadataBase`. Needs
 * `npm run build` at the root first.
 * `--sample`: only the records of `apps/web/src/lib/prerender-sample.ts` prerendered and no docs
 * site, for the review and e2e loop (the data files stay complete).
 */
import { spawn } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { executable } from './executable.ts'
import { dropFullPayloads } from './pages-payload.ts'

const base = process.env.PAGES_BASE_PATH
// Next's basePath: empty, or a path that starts with a slash and does not end in one
if (base === undefined || !/^(\/[^/]+)*$/.test(base))
  throw new Error('PAGES_BASE_PATH must be set: "" or a path such as /Ballistics')

const sample = process.argv.includes('--sample')
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
// the data files of `npm run dev:static` would end in the export beside the ones written below
rmSync(at('apps/web/public/api'), { recursive: true, force: true })
const api = await startBundleApi()
clearWebBuild()
try {
  // never the inherited value: the dev container sets `sample`, which leaves record pages out of the export
  await run(['run', 'build', '-w', '@open-reloading/web'], {
    API_URL: api.url,
    PRERENDER: sample ? 'sample' : 'full',
    // no docs site in a sample: no Docs link to a 404
    NEXT_PUBLIC_NO_DOCS: sample ? '1' : undefined,
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
}
if (!sample)
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
