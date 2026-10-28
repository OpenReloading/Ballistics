import { rowsCsv, type Spec, writeRows } from './fixture.ts'

const dp40 = 'demo-powder-dp40'
const sp20 = 'demo-powder-sp20'

/**
 * The synthetic set. The printed velocities are the model's, moved so that each used row has a
 * known absolute relative error:
 * - validation (cartridges 308-win and 30-30-win): errors 0.01, 0.02, 0.03, 0.04 and 0.10, two
 *   rows with a printed pressure at 0.1 and 0.2, and seven rows that cannot be used, one per reason;
 * - training (30-br, 308-match, 7-62-x-54-r): errors 0.01 to 0.10 in steps of 0.01;
 * - test (30-06-spring, 7-62-x-39): errors 0.02, 0.05 and 0.06.
 */
const specs: Spec[] = [
  { cartridge: '308-win', charge: 2.0, velocity: 0.01, pressure: 0.1, table: 'tableOne' },
  { cartridge: '308-win', charge: 2.2, velocity: -0.02, pressure: 0.2, table: 'tableOne' },
  { cartridge: '308-win', powder: sp20, charge: 2.4, velocity: 0.03 },
  { cartridge: '30-30-win', powder: sp20, charge: 1.0, velocity: -0.04, table: 'tableTwo' },
  { cartridge: '30-30-win', powder: dp40, charge: 1.2, velocity: 0.1 },
  // not used
  { cartridge: 'unknown-3', charge: 2.0, velocity: 0 },
  { cartridge: '308-win', bullet: 'no-bullet', charge: 2.0, velocity: 0 },
  { cartridge: '308-win', powder: 'no-powder', charge: 2.0, velocity: 0 },
  { cartridge: '308-win', powder: 'demo-powder-plain', charge: 2.0, velocity: 0 },
  { cartridge: '8-x-57-is', charge: 2.0, velocity: 0 },
  { cartridge: '308-win', charge: 2.0, barrel: null, velocity: 0 },
  { cartridge: '308-win', charge: 40, velocity: 0 },
  // training
  ...[
    ['30-br', 2.0, 0.01],
    ['30-br', 2.2, -0.02],
    ['30-br', 2.4, 0.03],
    ['30-br', 2.6, -0.04],
    ['308-match', 2.0, 0.05],
    ['308-match', 2.2, -0.06],
    ['308-match', 2.4, 0.07],
    ['7-62-x-54-r', 2.2, -0.08],
    ['7-62-x-54-r', 2.4, 0.09],
    ['7-62-x-54-r', 2.6, -0.1],
  ].map(([cartridge, charge, velocity]) => ({
    cartridge: cartridge as string,
    charge: charge as number,
    velocity: velocity as number,
  })),
  // test
  { cartridge: '30-06-spring', charge: 2.4, velocity: 0.05 },
  { cartridge: '30-06-spring', charge: 2.6, velocity: -0.06 },
  { cartridge: '7-62-x-39', charge: 1.0, velocity: 0.02 },
]

/** The path of the rows file of {@link specs}. */
export const rowsPath = writeRows(rowsCsv(specs))
