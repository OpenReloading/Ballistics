import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeStaticApi } from '@rangefoundry/api/static'
import { buildCatalogue } from '@rangefoundry/use-cases/catalog'
import { afterAll, vi } from 'vitest'
import { catalogueListContract } from '../../../packages/catalog/test/contract.ts'
import { catalogue } from '../src/lib/static-api.ts'

const dir = await mkdtemp(path.join(tmpdir(), 'catalogue-contract-'))

afterAll(async () => {
  vi.unstubAllGlobals()
  await rm(dir, { recursive: true, force: true })
})

// the static site answers lists from the index the Pages build writes; a record is its own data file, not a Catalogue get
catalogueListContract('the static site', async (bundle) => {
  await writeStaticApi(buildCatalogue(bundle), dir)
  // the data files as a static host serves them at the site root
  vi.stubGlobal('fetch', async (url: string) => {
    try {
      return new Response(await readFile(path.join(dir, url.replace(/^\/api\//, '')), 'utf8'))
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
  return catalogue()
})
