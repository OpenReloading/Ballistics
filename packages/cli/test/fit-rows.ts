import type { Spec } from './fixture.ts'
import { recordRoots, records, rowsCsv, writeRows } from './fixture.ts'

export const dp40 = 'demo-powder-dp40'
export const sp20 = 'demo-powder-sp20'
export const sp21 = 'demo-powder-sp21'

const record = records.powders.get(dp40)
if (!record?.interior) throw new Error(`${dp40} has no interior parameters`)
/** The planted truth: the fixture records with the burn coefficient of dp40 at 0.66096, 1.08 times its record value 0.612. */
export const planted = {
  ...records,
  powders: new Map(records.powders).set(dp40, {
    ...record,
    interior: { ...record.interior, vivacity: { ...record.interior.vivacity, value: 0.66096 } },
  }),
}

/** Training rows of dp40 in three cartridges and two validation rows, printed from the planted truth. */
export const specs: Spec[] = [
  ...[
    ['30-br', 2.0],
    ['30-br', 2.2],
    ['30-br', 2.4],
    ['30-br', 2.6],
    ['308-win', 2.0],
    ['308-win', 2.2],
    ['308-win', 2.4],
    ['30-06-spring', 2.2],
    ['30-06-spring', 2.4],
    ['30-06-spring', 2.6],
  ].map(([cartridge, charge]) => ({
    cartridge: cartridge as string,
    charge: charge as number,
    velocity: 0,
  })),
  { cartridge: '308-match', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', charge: 2.2, velocity: 0 },
]

export const options = {
  rows: writeRows(rowsCsv(specs, planted)),
  records: recordRoots,
  split: 'validation',
  final: false,
} as const
