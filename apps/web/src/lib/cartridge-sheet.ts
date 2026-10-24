import { sheetId } from '@open-reloading/schema'
import type { CartridgeDetail } from './api-types.ts'

/**
 * What the cartridge drawing reads of a record: the id of its C.I.P. sheet revision (figure ids
 * are built from it), the standard, name, table and values.
 */
export const drawable = (
  c: Pick<CartridgeDetail, 'id' | 'name' | 'table' | 'published' | 'revised' | 'values'>,
) => ({ id: sheetId(c), standard: 'CIP', name: c.name, table: c.table, values: c.values })
