/**
 * The web app's dev server on data files (apps/web/AGENTS.md, Static site): writes the data files of the
 * static site (`writeStaticApi`) into the git-ignored `apps/web/public/api`, which the dev server
 * serves, and starts `next dev` at the site root (`PAGES_BASE_PATH=''`). Its server-side reads go
 * to the API over the catalogue of the data bundle, in this process for the length of the run:
 * there is no API to start. Port 3000, `PORT` for another. Needs `npm run build` at the root first.
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { devExit, stopOnSignal } from './dev-exit.ts'
import { executable } from './executable.ts'

const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const dataDir = at('apps/web/public/api')

const api = await startBundleApi()
let dev: ChildProcess | undefined
// before the data files are written: a signal then skips the server start, the cleanup below still runs
const { stopped, dispose } = stopOnSignal(() => dev?.pid)
try {
  rmSync(dataDir, { recursive: true, force: true })
  await writeStaticApi(api.data, dataDir)
  if (!stopped()) {
    dev = spawn(executable('npm'), ['run', 'dev', '-w', '@open-reloading/web'], {
      cwd: at(''),
      // `full`: the inherited `sample` would leave records out of the generated routes
      env: {
        ...process.env,
        API_URL: api.url,
        PAGES_BASE_PATH: '',
        PRERENDER: 'full',
        // the docs site is not built here: no Docs link to a 404
        NEXT_PUBLIC_NO_DOCS: '1',
      },
      stdio: 'inherit',
      // a group of its own: npm does not pass a signal on to `next`, so the signal goes to the group
      detached: true,
    })
    await devExit(dev, stopped)
  }
} finally {
  // one failed removal must not leave the API open
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch (error) {
    console.error(error)
  }
  dispose()
  await api.close()
}
