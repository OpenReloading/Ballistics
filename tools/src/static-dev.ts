/**
 * The web app's dev server on data files (README, Pages edition): writes the data files of the
 * Pages edition (`writeStaticApi`) into the git-ignored `apps/web/public/api`, which the dev server
 * serves, and starts `next dev` at the site root (`PAGES_BASE_PATH=''`). Its server-side reads go
 * to the API over the catalogue of the data bundle, in this process for the length of the run:
 * there is no API to start. Port 3000, `PORT` for another. Needs `npm run build` at the root first.
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { executable } from './executable.ts'

const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const dataDir = at('apps/web/public/api')
// one edition's Turbopack cache fails the other's build
const clearWebBuild = () => rmSync(at('apps/web/.next'), { recursive: true, force: true })

const api = await startBundleApi()
clearWebBuild()
rmSync(dataDir, { recursive: true, force: true })
try {
  await writeStaticApi(api.data, dataDir)
  const dev = spawn(executable('npm'), ['run', 'dev', '-w', '@open-reloading/web'], {
    cwd: at(''),
    // `full`: the inherited `sample` would leave records out of the generated routes
    env: { ...process.env, API_URL: api.url, PAGES_BASE_PATH: '', PRERENDER: 'full' },
    stdio: 'inherit',
    // a group of its own: npm does not pass a signal on to `next`, so the signal goes to the group
    detached: true,
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => process.kill(-(dev.pid ?? 0), signal))
  await new Promise<void>((resolve, reject) => dev.on('error', reject).on('exit', () => resolve()))
} finally {
  clearWebBuild()
  rmSync(dataDir, { recursive: true, force: true })
  await api.close()
}
