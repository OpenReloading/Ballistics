/**
 * The words of the typed refusals that statistics, the group statistics of shot-groups and
 * ballistics raise (`InputError` of `@open-reloading/statistics` with an issue): the English
 * sentence of each code, `{name}` where a param stands. The language module loads them once a page
 * has started, outside every page's own JavaScript, for `refusalText` of `core-messages.ts`;
 * `core-message-table.ts` reads them as templates, so `translateMessage` shows a sentence in the
 * language shown. Hit probability and ring scoring word their own issues where they are shown.
 */
import type { ExteriorIssue, InteriorIssue } from '@open-reloading/ballistics'
import type { GroupStatisticsIssue } from '@open-reloading/shot-groups'
import type { Diagnostic, StatisticsIssue } from '@open-reloading/statistics'
import { english, type Message, msg } from '../i18n/translate.ts'

const statisticsWords = {
  probabilityOutsideUnit: msg('probability must lie in (0, 1)'),
  levelOutsideUnit: msg('level must lie in (0, 1)'),
  confidenceLevelOutsideUnit: msg('confidence level must lie in (0, 1)'),
  degreesOfFreedomNotPositive: msg('degrees of freedom must be positive'),
  degreesOfFreedomNotPositiveWhole: msg('degrees of freedom must be a positive whole number'),
  maxIterationsNotPositiveInteger: msg('maxIterations must be a positive integer'),
  maxConditionOutOfRange: msg('maxCondition must be finite and at least 1'),
  velocitiesNotFinite: msg('velocities must be finite'),
  relativeHalfWidthBelowMinimum: msg('relative half-width must be at least 0.01'),
  relativeHalfWidthOutOfReach: msg('relative half-width needs more shots than the search covers'),
} satisfies Record<StatisticsIssue['code'], Message>

const groupStatisticsWords = {
  'confidence-level': msg('confidence level must lie in (0, 1)'),
  distance: msg('distance must be positive'),
  'shot-coordinates': msg('shot coordinates must be finite'),
  'shot-velocity': msg('shot velocity must be finite'),
  aim: msg('aim must be finite'),
  coverage: msg('coverage must lie in (0, 1)'),
} satisfies Record<GroupStatisticsIssue['code'], Message>

const exteriorWords = {
  pressureInvalid: msg('pressure {pressure} Pa'),
  humidityOutsideUnit: msg('humidity {humidity} outside 0..1'),
  temperatureInvalid: msg('temperature {temperature} K'),
  altitudeOutsideRange: msg('altitude {altitude} m outside {low} to {high} m'),
  timeOfFlightNegative: msg('time of flight must be 0 or more'),
  rangeNotPositive: msg('range must be positive'),
  targetHeadingNotNumber: msg('target heading must be a number'),
  targetSpeedNegative: msg('target speed must be 0 or more'),
  muzzleVelocityNotConverged: msg('muzzle velocity did not converge'),
  measuredSpeedTooLow: msg(
    'the speed measured is lower than the bullet can keep over the distance',
  ),
  distanceNotReached: msg('distance {distance} m not reached ({stop})'),
  velocityNotPositive: msg('velocity must be positive'),
  distanceNegative: msg('distance must not be negative'),
  outlineOutsideMethod: msg('the outline gives no positive finite drag: outside the method'),
  machNotPositive: msg('mach must be positive'),
  diameterNotPositive: msg('diameter must be positive'),
  noseAndBoatTailExceedLength: msg('noseLength plus boatTailLength must not exceed length'),
  bandDiameterBelowDiameter: msg('bandDiameter must be at least the diameter'),
  meplatDiameterOutsideRange: msg('meplatDiameter must be zero up to the diameter'),
  baseDiameterNotPositive: msg('baseDiameter must be positive'),
  boatTailLengthNegative: msg('boatTailLength must be zero or more'),
  headShapeOutsideUnit: msg('headShape must be from 0 to 1'),
  outlineLengthsNotPositive: msg('length and noseLength must be positive'),
  noCandidate: msg('at least one candidate'),
  dispersionNotPositive: msg('dispersion must be positive'),
  entryValueInvalid: msg('entry value'),
  entryKindUnknown: msg('entry kind {kind}'),
  noEntryOrChronograph: msg('at least one entry or a chronograph'),
  chronographMeanInvalid: msg('chronograph mean'),
  entryRoundingNegative: msg('{kind} rounding must not be negative'),
  entryStandardDeviationNotPositive: msg('{kind} standardDeviation must be positive'),
  entryShotCountInvalid: msg('{kind} shotCount must be a whole number of at least 1'),
  entryRangeInvalid: msg('{kind} range'),
  maxRelativeStandardUncertaintyNotPositive: msg('maxRelativeStandardUncertainty must be positive'),
  maxInflationNotAboveOne: msg('maxInflation must exceed 1'),
  residualConfidenceLevelOutsideUnit: msg('residualConfidenceLevel must lie in (0, 1)'),
  confidenceLevelOptionOutsideUnit: msg('confidenceLevel must lie in (0, 1)'),
  zeroOffsetPriorWithoutFit: msg('a zeroOffset prior needs the fitZeroOffset option'),
  priorNotPositive: msg('prior {name} must be positive'),
  priorUnknown: msg('prior {name}'),
  clickValueNotPositive: msg('click value must be positive'),
  maxZeroSigmaNotPositive: msg('maxZeroSigma must be positive'),
  muzzleVelocityNotPositive: msg('muzzle velocity must be positive'),
  stepSizeBelowMinimum: msg('step size {step} s below {min} s'),
  integrationBudgetExceeded: msg('more than {max} integration steps in total'),
  integrationStepsExceeded: msg('more than {max} integration steps'),
  stabilityInputsNotPositive: msg('mass, diameter, length, twist and velocity must be positive'),
  rangeInvalid: msg('range {range}'),
  zeroNotConverged: msg('zero did not converge (miss {vertical} m, {horizontal} m)'),
  zeroRangeNotReached: msg('zero range {range} m not reached ({stop})'),
  momentSlopeNotPositive: msg('momentSlope must be positive (spin-stabilised bullet)'),
  momentSlopeNeedsLength: msg('a missing momentSlope needs the length'),
  inertiaNotPositive: msg('moments of inertia must be positive'),
  inertiaNeedsLength: msg('a missing moment of inertia needs the length'),
  modifiedPointMassNeedsLiftSlope: msg('the modified point mass needs liftSlope'),
  modifiedPointMassNeedsTwist: msg('the modified point mass needs twist and twist hand'),
  modifiedPointMassNeedsAerodynamics: msg('the modified point mass needs projectile.aerodynamics'),
  coefficientTableMachNotRising: msg('{name} table Mach must rise'),
  coefficientTableNodeInvalid: msg('{name} table node'),
  coefficientTableTooShort: msg('{name} table needs at least two nodes'),
  coefficientNotFinite: msg('{name} must be finite'),
  modelUnknown: msg('model {model}'),
  zeroToleranceOrMaxYawNotPositive: msg('zero tolerance and maximum yaw must be positive'),
  gravityInvalid: msg('gravity'),
  stepBudgetInvalid: msg('step budget'),
  tolerancesInvalid: msg('tolerances and limits'),
  azimuthInvalid: msg('azimuth'),
  latitudeInvalid: msg('latitude'),
  lookAngleOutsideRange: msg('look angle outside -pi/2..pi/2'),
  boreAnglesInvalid: msg('bore angles'),
  zeroLookAngleOutsideRange: msg('zero look angle outside -pi/2..pi/2'),
  zeroRangeNotPositive: msg('zero range must be positive'),
  twistNotPositive: msg('twist must be positive'),
  sightInvalid: msg('sight height and offset'),
  lengthNotPositive: msg('length must be positive'),
  massNotPositive: msg('mass must be positive'),
  dragInterpolationUnknown: msg('drag interpolation {interpolation}'),
  dragCurveMachNotRising: msg('drag curve Mach must rise'),
  dragCurveNodeInvalid: msg('drag curve node'),
  dragCurveTooShort: msg('a drag curve needs at least two nodes'),
  bcReferenceUnknown: msg('BC reference {reference}'),
  bcBandsSameSpeed: msg('BC bands need distinct speeds'),
  bcBandInvalid: msg('BC band'),
  noBcBand: msg('at least one BC band'),
  dragModelUnknown: msg('drag model {model}'),
  windSegmentsNotRising: msg('wind segments must end in rising order'),
  windSegmentInvalid: msg('wind segment'),
  sessionWithoutObservation: msg('at least one observation per session'),
  noSession: msg('at least one session'),
  knotsNeedSingleBandOrCurve: msg('knots need a single-band BC or a curve'),
  knotsNotRising: msg('knots must rise'),
  knotMachNotPositive: msg('knot Mach must be positive'),
  knotsTooFew: msg('at least two knots'),
  mixedObservationsNeedUncertainty: msg(
    'observations of different kinds need standard uncertainties',
  ),
  standardUncertaintyPartial: msg('standardUncertainty on all observations or none'),
  standardUncertaintyNotPositive: msg('standardUncertainty must be positive'),
  observationRangeInvalid: msg('observation range {range}'),
  observationValueInvalid: msg('observation value'),
  observationKindUnknown: msg('observation kind {kind}'),
  noObservation: msg('at least one observation'),
  maxTotalStepsNotPositive: msg('maxTotalSteps must be positive'),
  airDensityOutsideRange: msg(
    'pressure {pressure} Pa at temperature {temperature} K gives an air density of {density} kg/m3, outside 0 to {max} kg/m3',
  ),
  groupSharesShots: msg(
    'group {group}: an impact and a dial entry share their shots, keep one or name two groups',
  ),
  rangeNotReached: msg('range {range} m not reached'),
  rangeGroupSharesShots: msg(
    'group {range} m: an impact and a dial entry share their shots, keep one or name two groups',
  ),
} satisfies Record<ExteriorIssue['code'], Message>

/** The codes interior shares with exterior and statistics take their words there. */
const interiorWords = {
  gasVelocityFactorNegative: msg('Gas velocity factor must not be negative.'),
  muzzleVelocityNegative: msg('Muzzle velocity must not be negative.'),
  chargeMassNegative: msg('Charge mass must not be negative.'),
  projectileMassNotPositive: msg('Projectile mass must be positive.'),
  firearmMassNotPositive: msg('Firearm mass must be positive.'),
  loadRatioTargetNeedsBulkDensity: msg('the load ratio target needs the bulk density'),
  bulkDensityNotPositive: msg('bulk density must be above 0'),
  targetValueNotPositive: msg('target value must be above 0'),
  ladderChargeBelowZero: msg('ladder charge {charge} kg must be above 0'),
  ladderAroundNeedsOddCount: msg('a ladder around the charge needs an odd count'),
  ladderStepCountInvalid: msg('ladder steps must be an integer of at least 1'),
  ladderStepNotPositive: msg('ladder step must be above 0'),
  ladderStartNotPositive: msg('ladder start charge must be above 0'),
  boreResistanceNeedsValues: msg('the bore resistance of the powder needs {missing}'),
  powderWithoutInteriorModel: msg('the powder has no interior model'),
  bulletConstructionUnknown: msg('unknown bullet construction {construction}'),
  barrelNotPositive: msg('barrel {barrel} m must be a positive number'),
  dynamicVivacityRangeInvalid: msg('dynamic vivacity: need 0 <= from < to <= 1'),
  dynamicVivacityExponentNotOne: msg('dynamic vivacity: exponent must be 1'),
} satisfies Record<
  Exclude<InteriorIssue['code'], ExteriorIssue['code'] | StatisticsIssue['code']>,
  Message
>

/** Joins two packages' words; a code both use fails `tsc`, since a refusal carries no package. */
const disjoint = <L extends object, R extends object>(
  l: L,
  r: R & { [K in keyof L & keyof R]: never },
) => ({ ...l, ...r })

/** The words of every code. */
export const refusalWords: Readonly<Record<string, Message>> = disjoint(
  disjoint(disjoint(statisticsWords, groupStatisticsWords), exteriorWords),
  interiorWords,
)

/** A param as the sentence shows it: a list joined by commas, a number as JavaScript writes it. */
const shown = (v: unknown) => (Array.isArray(v) ? v.join(', ') : String(v))

/** The English sentence of a typed refusal; undefined for a code without words. */
export function refusalSentence({ code, params }: Diagnostic<string, object>): string | undefined {
  const words = Object.hasOwn(refusalWords, code) ? refusalWords[code] : undefined
  const values = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, shown(v)]))
  return words && english.t(words, values)
}
