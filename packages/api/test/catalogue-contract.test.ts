import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Bundle } from '@open-reloading/catalog'
import { buildCatalogue, openCatalogue } from '@rangefoundry/use-cases/catalog'
import { afterAll } from 'vitest'
import { catalogueListContract, catalogueRecordContract } from '../../catalog/test/contract.ts'
import { loadCatalogue, writeCatalogue } from '../src/catalogue/node.ts'

const dir = mkdtempSync(join(tmpdir(), 'catalogue-contract-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const inMemory = (bundle: Bundle) => openCatalogue(buildCatalogue(bundle))
/** The API server's catalogue: the files the build writes, read back. */
const fromFiles = (bundle: Bundle) => {
  writeCatalogue(bundle, dir)
  return loadCatalogue(dir)
}

catalogueListContract('in memory', inMemory)
catalogueRecordContract('in memory', inMemory)
catalogueListContract('the API server', fromFiles)
catalogueRecordContract('the API server', fromFiles)
