// Builds the Pages site into `pages/`; settings and flags: apps/docs/docs/release.md#pages-site
import { spawn } from 'node:child_process'
import { cpSync, globSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { executable } from './executable.ts'

const base = process.env.PAGES_BASE_PATH ?? ''
// Vite's base without its trailing slash: empty, or a path that starts with a slash and does not end in one
if (!/^(\/[^/]+)*$/.test(base))
  throw new Error('PAGES_BASE_PATH must be "" or a path such as /Ballistics')

const sample = process.argv.includes('--sample')
const docs = !sample && !process.argv.includes('--no-docs')
const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const site = at('pages')

/** Runs pnpm without blocking this process. */
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

// never the inherited value: the dev container sets `sample`, which leaves record pages out of the build
await run(['--filter', '@rangefoundry/web', 'run', 'build'], {
  PRERENDER: sample ? 'sample' : 'full',
  PAGES_BASE_PATH: base,
  // no docs site: no Docs link to a 404
  NEXT_PUBLIC_NO_DOCS: docs ? undefined : '1',
})
rmSync(site, { recursive: true, force: true })
// a move, not a copy: a recursive cpSync into the dev container's bind mount fails with EACCES on macOS
renameSync(at('apps/web/dist/client'), site)
// GitHub Pages answers every miss with 404.html: the app shell, whose router shows the path's page or Not found
cpSync(`${site}/_shell.html`, `${site}/404.html`)
// the next edition registered its worker below next/: the same cleanup worker replaces it
cpSync(`${site}/sw.js`, `${site}/next/sw.js`)
const bytes = globSync('assets/**', { cwd: site })
  .map((file) => statSync(`${site}/${file}`))
  .filter((stat) => stat.isFile())
  .reduce((sum, stat) => sum + stat.size, 0)
console.log(`client scripts and styles: ${Math.round(bytes / 1024)} KiB`)
// no API on the Pages site: the docs' REST page has no link to one
const docsEnv = {
  DOCS_BASE_URL: `${base}/docs/`,
  APP_URL: process.env.PAGES_URL && `${process.env.PAGES_URL}${base}/`,
  API_URL: undefined,
  PAGES_BASE_PATH: undefined,
}
if (docs)
  await run(['--filter', '@rangefoundry/docs', 'run', 'site:build', '--out-dir', `${site}/docs`], {
    ...docsEnv,
    ...(process.env.PAGES_URL && { DOCS_URL: process.env.PAGES_URL }),
  })
for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}/${file}`)
cpSync(at('packages/catalog/LICENSE'), `${site}/data/LICENSE`)
// GitHub Pages serves the files as they are, without Jekyll
writeFileSync(`${site}/.nojekyll`, '')
console.log(`pages/: the Pages site under ${base || '/'}`)
