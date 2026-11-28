import { join } from 'node:path'
import * as reader from '../../../packages/catalog-files/src/records.ts'

/** Directory `records/` of the catalog package, the root these read without one. */
const recordsDir = join(import.meta.dirname, '..', '..', '..', 'packages', 'catalog', 'records')

/** `readRecords` of `@rangefoundry/catalog-files`, by source path as the catalog build runs before that package is built. */
export const readRecords = (root: string | readonly string[] = recordsDir) =>
  reader.readRecords(root)

/** `validateRecords` of `@rangefoundry/catalog-files`, what `data:validate` checks. */
export const validateRecords = (root: string | readonly string[] = recordsDir) =>
  reader.validateRecords(root)
