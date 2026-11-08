const exterior: ExteriorUnits = {
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
}

const truing: TruingUnits = { ...exterior, muzzleVelocity: 'm/s', dragFactor: '1' }

const rangeStrings: RangeStringsUnits = {
  ...exterior,
  muzzleVelocity: 'm/s',
  dragFactor: '1',
  clickValue: 'rad',
  zeroOffset: 'rad',
}

const m3: M3Units = {
  time: 's',
  travel: 'm',
  velocity: 'm/s',
  pressure: 'Pa',
  gasTemperature: 'K',
  energy: 'J',
  burntFraction: '1',
  efficiency: '1',
  mass: 'kg',
}

/** Unit per field name of a trajectory answer. */
interface ExteriorUnits {
  readonly range: 'm'
  readonly distance: 'm'
  readonly altitude: 'm'
  readonly heightAboveFiringPoint: 'm'
  readonly height: 'm'
  readonly windage: 'm'
  readonly spinDrift: 'm'
  readonly jump: 'm'
  readonly time: 's'
  readonly velocity: 'm/s'
  readonly mach: '1'
  readonly energy: 'J'
  readonly pathAngle: 'rad'
  readonly elevationHold: 'rad'
  readonly windageHold: 'rad'
  readonly yaw: 'rad'
  readonly spin: 'rad/s'
  readonly bore: 'rad'
  readonly elevationAngle: 'rad'
  readonly windageAngle: 'rad'
  readonly stability: '1'
  readonly mass: 'kg'
  readonly diameter: 'm'
  readonly length: 'm'
  readonly ballisticCoefficient: 'kg/m2'
  readonly minVelocity: 'm/s'
  // input fields echoed in truing.shot
  readonly sightOffset: 'm'
  readonly twist: 'm'
  readonly lookAngle: 'rad'
  readonly pressure: 'Pa'
  readonly temperature: 'K'
  readonly humidity: '1'
  readonly endDistance: 'm'
  readonly speed: 'm/s'
  readonly vertical: 'm/s'
  readonly fromDirection: 'rad'
  readonly latitude: 'rad'
  readonly azimuth: 'rad'
}
/** Unit per field name of a truing answer. */
interface TruingUnits extends ExteriorUnits {
  readonly muzzleVelocity: 'm/s'
  readonly dragFactor: '1'
}
/** Unit per field name of a range-strings answer. */
interface RangeStringsUnits extends TruingUnits {
  readonly clickValue: 'rad'
  readonly zeroOffset: 'rad'
}
/** Unit per field name of an M3 interior answer. */
interface M3Units {
  readonly time: 's'
  readonly travel: 'm'
  readonly velocity: 'm/s'
  readonly pressure: 'Pa'
  readonly gasTemperature: 'K'
  readonly energy: 'J'
  readonly burntFraction: '1'
  readonly efficiency: '1'
  readonly mass: 'kg'
}

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
