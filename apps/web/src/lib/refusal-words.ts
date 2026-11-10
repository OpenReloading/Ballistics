/** English sentences of the typed refusals (`InputError` of `@open-reloading/statistics` with an issue) and `RecordNotFound`, loaded once a page has started, outside every page's own JavaScript; `core-message-table.ts` reads them as templates. */
import type { ExteriorIssue, InteriorIssue, LoadFileIssue } from '@open-reloading/ballistics'
import type { GroupStatisticsIssue } from '@open-reloading/shot-groups'
import type { Diagnostic, StatisticsIssue } from '@open-reloading/statistics'
import type { RecordNotFoundIssue, UseCaseIssue } from '@open-reloading/use-cases'
import { english, type Message, msg } from '../i18n/translate.ts'
import { gapWords } from './resistance-gaps.ts'

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
  modelLeavesBarrelBeforeWindowEnd: msg(
    'the model at the start values leaves the barrel before the end of the trace window; start closer or raise fallFraction',
  ),
  traceWindowTooShort: msg('too few trace samples in the window'),
  traceNoPositivePressure: msg('the trace has no positive pressure'),
  sigmaPartial: msg('sigma: on every trace or on none'),
  chargeNotPositive: msg('charge must be positive'),
  noTrace: msg('at least one trace'),
  curveFitNeedsTwoStageVivacity: msg('a curve fit needs a vivacity burn law with a two-stage form'),
  fallFractionOutsideUnit: msg('fallFraction must lie in (0, 1)'),
  exponentStartNotPositive: msg('exponent needs a start value above 0'),
  transitionStartNotBelowOne: msg('transition needs a start value below 1'),
  formSlopeStartNotPositive: msg('formSlope needs a start value above 0'),
  curveFitParametersInvalid: msg(
    'parameters: burnRate, formSlope, transition and exponent, each at most once',
  ),
  sigmaNotPositive: msg('sigma must be positive'),
  traceSensorUnknown: msg('trace.sensor: breech, mean or base'),
  traceInvalid: msg(
    'trace: equal numbers of finite, strictly increasing times and finite pressures, at least 2',
  ),
  traceNeverFalls: msg('the trace never falls to the fall fraction of its peak after the peak'),
  rangeWithoutWidth: msg('the range has no width'),
  countNotPositiveInteger: msg('count must be a positive integer'),
  burnCoefficientOrEnergyNotPositive: msg('burn coefficient and energy must be positive'),
  noPoint: msg('at least one point'),
  inputUncertaintyNegative: msg('{input}: standardUncertainty must be 0 or above'),
  noHeldOutString: msg('at least one held-out string'),
  velocitySigmaMissing: msg('velocitySigma on every point'),
  targetPowderNotInFit: msg('the powder of the target must be one of the fit'),
  velocitySigmaNegative: msg('velocitySigma must be 0 or above'),
  pooledFitNoCovariance: msg('the pooled fit has no covariance'),
  groupPriorNotPositive: msg('prior {kind} of {group}: value and sigma above 0'),
  priorPowderNotInSessions: msg('a prior needs its powder in the sessions'),
  sessionsBurnKindDiffers: msg('the sessions of a powder share one burn kind'),
  barrelOrTemperatureOnPoint: msg('barrel length and temperature per session'),
  ladderChargeOrVelocityNotPositive: msg('ladder charge and velocity positive'),
  propellantTemperatureNotPositive: msg('propellantTemperature must be positive'),
  barrelLengthNotPositive: msg('barrelLength must be positive'),
  sessionWithoutLadderPoint: msg('at least one ladder point per session'),
  rifleOrLotSigmaNotPositive: msg('rifleSigma and lotSigma must be positive'),
  pooledFitParametersInvalid: msg(
    'parameters: burnRate, temperatureFactor, each at most once, burnRate always',
  ),
  priorParameterNotFitted: msg('a prior needs its parameter in parameters'),
  burnCoefficientNotFitted: msg('the burn coefficient is always fitted'),
  stringWithoutVelocity: msg('every string needs at least one velocity'),
  fitNoCovariance: msg('the fit has no covariance: add rows or velocity sigmas'),
  boreDiameterNotPositive: msg('boreDiameter must be positive'),
  startPressureTooLow: msg(
    'startPressure must be above the ignition pressure and the resistance at travel 0',
  ),
  domainMarginOutsideRange: msg('domainMargin must lie in [0, 1)'),
  priorsNeedVelocitySigmas: msg('priors and huberThreshold need velocity sigmas'),
  huberThresholdNotPositive: msg('huberThreshold must be positive'),
  temperatureFactorNeedsSensitivity: msg(
    'temperatureFactor needs the load to carry a temperature sensitivity other than 0',
  ),
  fitParametersInvalid: msg('parameters: {parameters}, each at most once'),
  pressuresNeedVelocitySigmas: msg('pressures need velocity sigmas'),
  velocitySigmaPartial: msg('velocitySigma on all points or none'),
  pressureBasisUnknown: msg('pressureBasis must be one of {bases}'),
  pressureWithoutBasis: msg('peakPressure and pressureBasis together'),
  pressureWithoutSigma: msg('peakPressure and pressureSigma together'),
  pressureSigmaNotPositive: msg('pressureSigma must be positive'),
  ladderPressureNotPositive: msg('ladder pressure must be positive'),
  velocitySigmaNotPositive: msg('velocitySigma must be positive'),
  ladderVelocityNotPositive: msg('ladder velocity must be positive'),
  ladderChargeNotPositive: msg('ladder charge must be positive'),
  noLadderPoint: msg('at least one ladder point'),
  heightsOrVelocitiesNotFinite: msg('heights and velocities must be finite'),
  shotWithoutHeightOrVelocity: msg('each shot needs a height and a velocity'),
  chargeTooFewShots: msg('each charge needs at least two shots'),
  slopeNotFinite: msg('slope must be finite'),
  ladderTooFewCharges: msg('a ladder needs at least three charges'),
  ladderLowestChargeNotPositive: msg('ladder charge {charge} kg must be above 0'),
  ladderAroundNeedsOddCount: msg('a ladder around the charge needs an odd count'),
  ladderStepCountInvalid: msg('ladder steps must be an integer of at least 1'),
  ladderStepNotPositive: msg('ladder step must be above 0'),
  ladderStartNotPositive: msg('ladder start charge must be above 0'),
  boreResistanceNeedsValues: msg('the bore resistance of the powder needs {missing}'),
  powderWithoutInteriorModel: msg('the powder has no interior model'),
  bulletConstructionUnknown: msg('unknown bullet construction {construction}'),
  barrelNotPositive: msg('barrel {barrel} m must be a positive number'),
  ladderTooFewStrings: msg('a ladder needs at least two strings'),
  chargesEqual: msg('charges must differ'),
  stringTooFewShots: msg('each string needs at least two shots'),
  standardDeviationNegative: msg('standard deviation must be 0 or more'),
  meanNotFinite: msg('mean must be finite'),
  dynamicVivacityRangeInvalid: msg('dynamic vivacity: need 0 <= from < to <= 1'),
  dynamicVivacityExponentNotOne: msg('dynamic vivacity: exponent must be 1'),
  priorValueOrSigmaNotPositive: msg('prior {name}: value above 0, sigma above 0'),
  priorValueBelowFloorOrSigmaNotPositive: msg('prior {name}: value above the floor, sigma above 0'),
  pressureBasesMixed: msg('pressure rows use more than one basis: {rows}'),
} satisfies Record<
  Exclude<InteriorIssue['code'], ExteriorIssue['code'] | StatisticsIssue['code']>,
  Message
>

const loadFileWords = {
  valueMissing: msg('Enter a number for {field}.'),
  valueNegative: msg('{field} must be at least 0.'),
  burnFormPartial: msg('Burn form: {missing} needed with the others, or leave all four empty.'),
  valueNotNumber: msg('Enter a number.'),
  valueNotPositive: msg('Must be above 0.'),
  valueBelowZero: msg('Must be at least 0.'),
  engravingValueNeeded: msg('Needed with the other engraving value, or from a powder record.'),
} satisfies Record<LoadFileIssue['code'], Message>

const useCaseWords = {
  resultNotFinite: msg('result holds a non-finite number at {path}'),
  powderBulkDensityOutOfRange: msg(
    'powder {powder} bulk density {density} kg/m3 must be above 0 and at most {max} kg/m3',
  ),
  powderWithoutBulkDensity: msg('powder {powder} has no bulk density'),
  bulletWithoutDiameter: msg('bullet {bullet} has no diameter'),
  bulletWithoutLength: msg('bullet {bullet} has no length'),
  bulletValueOutOfBounds: msg(
    'bullet {bullet} {key} {value} {unit} must be within {low} and {high} {unit}',
  ),
  bulletWithoutCoefficient: msg('bullet {bullet} has no {model} ballistic coefficient'),
  bulletCoefficientsWithoutBands: msg(
    'bullet {bullet} has {count} {model} values without distinct velocity bands; send drag explicitly',
  ),
  ladderChargeNotAboveZero: msg('ladder charge {charge} g must be above 0'),
  recordNotFound: msg('{kind} {id} not found'),
} satisfies Record<(UseCaseIssue | RecordNotFoundIssue)['code'], Message>

/** Joins two packages' words; a code both use fails `tsc`, since a refusal carries no package. */
const disjoint = <L extends object, R extends object>(
  l: L,
  r: R & { [K in keyof L & keyof R]: never },
) => ({ ...l, ...r })

/** The words of every code. */
export const refusalWords: Readonly<Record<string, Message>> = disjoint(
  disjoint(
    disjoint(
      disjoint(disjoint(statisticsWords, groupStatisticsWords), exteriorWords),
      interiorWords,
    ),
    loadFileWords,
  ),
  useCaseWords,
)

/** An item of a list param: a resistance gap in its words, anything else as it is. */
const item = (x: unknown) =>
  typeof x === 'string' && Object.hasOwn(gapWords, x)
    ? gapWords[x as keyof typeof gapWords]
    : String(x)

/** A list joined by commas, the pressure rows counted per basis, a number as JavaScript writes it; a load file field arrives labelled (`interior-input.ts`). */
function shown(name: string, v: unknown): string {
  if (Array.isArray(v)) return v.map(item).join(', ')
  if (name === 'rows' && typeof v === 'object' && v !== null)
    return Object.entries(v)
      .map(([basis, n]) => `${String(n)} ${basis}`)
      .join(', ')
  return String(v)
}

/** The English sentence of a typed refusal; undefined for a code without words. */
export function refusalSentence({ code, params }: Diagnostic<string, object>): string | undefined {
  const words = Object.hasOwn(refusalWords, code) ? refusalWords[code] : undefined
  const values = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, shown(k, v)]))
  return words && english.t(words, values)
}
