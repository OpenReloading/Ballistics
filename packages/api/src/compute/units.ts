const exterior = {
  range: 'm',
  distance: 'm',
  altitude: 'm',
  heightAboveFiringPoint: 'm',
  height: 'm',
  windage: 'm',
  spinDrift: 'm',
  jump: 'm',
  time: 's',
  velocity: 'm/s',
  mach: '1',
  energy: 'J',
  pathAngle: 'rad',
  elevationHold: 'rad',
  windageHold: 'rad',
  yaw: 'rad',
  spin: 'rad/s',
  bore: 'rad',
  elevationAngle: 'rad',
  windageAngle: 'rad',
  stability: '1',
  mass: 'kg',
  diameter: 'm',
  length: 'm',
  ballisticCoefficient: 'kg/m2',
  minVelocity: 'm/s',
  // input fields echoed in truing.shot
  sightOffset: 'm',
  twist: 'm',
  lookAngle: 'rad',
  pressure: 'Pa',
  temperature: 'K',
  humidity: '1',
  endDistance: 'm',
  speed: 'm/s',
  vertical: 'm/s',
  fromDirection: 'rad',
  latitude: 'rad',
  azimuth: 'rad',
} as const

const truing = { ...exterior, muzzleVelocity: 'm/s', dragFactor: '1' } as const

const rangeStrings = {
  ...exterior,
  muzzleVelocity: 'm/s',
  dragFactor: '1',
  clickValue: 'rad',
  zeroOffset: 'rad',
} as const

const m3 = {
  time: 's',
  travel: 'm',
  velocity: 'm/s',
  pressure: 'Pa',
  gasTemperature: 'K',
  energy: 'J',
  burntFraction: '1',
  efficiency: '1',
  mass: 'kg',
} as const

/** Unit per field name of a trajectory answer. */
interface ExteriorUnits extends Readonly<typeof exterior> {}
/** Unit per field name of a truing answer. */
interface TruingUnits extends Readonly<typeof truing> {}
/** Unit per field name of a range-strings answer. */
interface RangeStringsUnits extends Readonly<typeof rangeStrings> {}
/** Unit per field name of an M3 interior answer. */
interface M3Units extends Readonly<typeof m3> {}

/**
 * Unit per field name and endpoint. Fields inside `energy` take the unit of that object (J); other
 * names take the entry their name ends with.
 */
export interface ResponseUnits {
  exterior: ExteriorUnits
  truing: TruingUnits
  rangeStrings: RangeStringsUnits
  m3: M3Units
  stability: { result: '1' }
}

/** The values of {@link ResponseUnits}. */
export const responseUnits: ResponseUnits = {
  exterior,
  truing,
  rangeStrings,
  m3,
  stability: { result: '1' },
}
