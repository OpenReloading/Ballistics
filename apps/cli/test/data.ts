import { rowsCsv, type Spec, writeRows } from './fixture.ts'

const dp40 = 'demo-powder-dp40'
const sp20 = 'demo-powder-sp20'

/** Printed velocities are the model's, moved so each used row has a known absolute relative error: validation (308-match, 30-30-win) 0.01, 0.02, 0.03, 0.04 and 0.10, two printed pressures at 0.1 and 0.2 and seven unusable rows, one per reason; training (30-br, 308-win, 30-06-spring) 0.01 to 0.10 in steps of 0.01; test (307-win, 300-win-mag) 0.02, 0.05 and 0.06. */
const specs: Spec[] = [
  { cartridge: '308-match', charge: 2.0, velocity: 0.01, pressure: 0.1, table: 'tableOne' },
  { cartridge: '308-match', charge: 2.2, velocity: -0.02, pressure: 0.2, table: 'tableOne' },
  { cartridge: '308-match', powder: sp20, charge: 2.4, velocity: 0.03 },
  { cartridge: '30-30-win', powder: sp20, charge: 1.0, velocity: -0.04, table: 'tableTwo' },
  { cartridge: '30-30-win', powder: dp40, charge: 1.2, velocity: 0.1 },
  // not used
  { cartridge: 'unknown-4', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', bullet: 'no-bullet', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', powder: 'no-powder', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', powder: 'demo-powder-plain', charge: 2.0, velocity: 0 },
  { cartridge: '7-62-x-54-r', charge: 2.0, velocity: 0 },
  { cartridge: '308-match', charge: 2.0, barrel: null, velocity: 0 },
  { cartridge: '308-match', charge: 40, velocity: 0 },
  // training
  ...[
    ['30-br', 2.0, 0.01],
    ['30-br', 2.2, -0.02],
    ['30-br', 2.4, 0.03],
    ['30-br', 2.6, -0.04],
    ['308-win', 2.0, 0.05],
    ['308-win', 2.2, -0.06],
    ['308-win', 2.4, 0.07],
    ['30-06-spring', 2.2, -0.08],
    ['30-06-spring', 2.4, 0.09],
    ['30-06-spring', 2.6, -0.1],
  ].map(([cartridge, charge, velocity]) => ({
    cartridge: cartridge as string,
    charge: charge as number,
    velocity: velocity as number,
  })),
  // test
  { cartridge: '307-win', charge: 2.4, velocity: 0.05 },
  { cartridge: '307-win', charge: 2.6, velocity: -0.06 },
  { cartridge: '300-win-mag', charge: 4.0, velocity: 0.02 },
]

/** The path of the rows file of {@link specs}. */
export const rowsPath = writeRows(rowsCsv(specs))
