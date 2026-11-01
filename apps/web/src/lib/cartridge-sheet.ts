import { type SpecValue, sheetId } from '@open-reloading/schema'
import type { CartridgeDetail } from './api-types.ts'

/**
 * What the cartridge drawing reads of a record: the id of its C.I.P. sheet revision (figure ids
 * are built from it), the standard, name, table and values.
 */
/** The sheet with the cartridge's case length L3 (mm) replaced: a length the user typed over the record's. */
export const withCaseLength = <S extends { values: SpecValue[] }>(spec: S, mm: number): S => ({
  ...spec,
  values: spec.values.map((v) =>
    v.side === 'cartridge' && v.symbol === 'L3' && !v.variant ? { ...v, value: mm } : v,
  ),
})

export const drawable = (
  c: Pick<CartridgeDetail, 'id' | 'name' | 'table' | 'published' | 'revised' | 'values'>,
) => ({ id: sheetId(c), standard: 'CIP', name: c.name, table: c.table, values: c.values })
