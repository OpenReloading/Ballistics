// Builds the Pages site into `pages/`; settings and flags: apps/docs/docs/release.md#pages-site
import { spawn } from 'node:child_process'
import { cpSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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

/** Runs pnpm without blocking this process: the build reads the API it serves. */
function run(args: string[], env: Record<string, string | undefined>) {
  return new Promise<void>((resolve, reject) => {
    spawn(executable('pnpm'), args, {
      cwd: at(''),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
      .on('error', reject)
      .on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`pnpm ${args.join(' ')} failed`)),
      )
  })
}

// the data files of `pnpm run dev:static` would end in the export beside the ones written below
rmSync(at('apps/web/public/api'), { recursive: true, force: true })
const api = await startBundleApi()
try {
  // never the inherited value: the dev container sets `sample`, which leaves record pages out of the export
  await run(['--filter', '@open-reloading/web', 'run', 'build'], {
    API_URL: api.url,
    PRERENDER: sample ? 'sample' : 'full',
    PAGES_BASE_PATH: base,
    PAGES_EDITION: edition,
    // no docs site: no Docs link to a 404
    NEXT_PUBLIC_NO_DOCS: docs ? undefined : '1',
  })
  rmSync(site, { recursive: true, force: true })
  // a move, not a copy: a recursive cpSync into the dev container's bind mount fails with EACCES on macOS
  renameSync(at('apps/web/out'), site)
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
    ['--filter', '@open-reloading/docs', 'run', 'site:build', '--out-dir', `${site}/docs`],
    {
      ...docsEnv,
      ...(process.env.PAGES_URL && { DOCS_URL: process.env.PAGES_URL }),
    },
  )
for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}/${file}`)
cpSync(at('packages/catalog/LICENSE'), `${site}/data/LICENSE`)
// GitHub Pages serves the files as they are, `_next/` among them, without Jekyll
writeFileSync(`${site}/.nojekyll`, '')
console.log(`pages/: the Pages site under ${base || '/'}`)
