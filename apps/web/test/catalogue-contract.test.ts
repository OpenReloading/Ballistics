import { buildCatalogue } from '@open-reloading/api/catalogue'
import { vi } from 'vitest'
import { catalogueListContract } from '../../../packages/catalog/test/contract.ts'

const files = vi.hoisted(() => ({ index: undefined as unknown }))
vi.mock('../src/lib/data-file.ts', () => ({ dataFile: async () => files.index }))

const { catalogue } = await import('../src/lib/static-api.ts')

// the static site answers lists from its index; a record is its own data file, not a Catalogue get
catalogueListContract('the static site', (bundle) => {
  files.index = JSON.parse(JSON.stringify(buildCatalogue(bundle).index))
  return catalogue()
})
