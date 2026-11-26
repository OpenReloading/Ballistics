/** English sentences of the typed refusals (`InputError` of `@rangefoundry/statistics` with an issue) and `RecordNotFound`, loaded once a page has started, outside every page's own JavaScript; `core-message-table.ts` reads them as templates. */
import type { ExteriorIssue, InteriorIssue, LoadFileIssue } from '@rangefoundry/ballistics'
import type { GroupStatisticsIssue } from '@rangefoundry/shot-groups'
import type { Diagnostic, StatisticsIssue } from '@rangefoundry/statistics'
import type { RecordNotFoundIssue, UseCaseIssue } from '@rangefoundry/use-cases'
import { english, type Message, msg } from '../i18n/translate.ts'
import type { Described } from './core-messages.ts'
import { gapWords } from './resistance-gaps.ts'

const statisticsWords = {
  probabilityOutsideUnit: /*i18n*/ {
    id: 'refusal.probabilityOutsideUnit',
    message: 'probability must lie in (0, 1)',
  },
  levelOutsideUnit: /*i18n*/ {
    id: 'refusal.levelOutsideUnit',
    message: 'level must lie in (0, 1)',
  },
  confidenceLevelOutsideUnit: /*i18n*/ {
    id: 'refusal.confidenceLevelOutsideUnit',
    message: 'confidence level must lie in (0, 1)',
  },
  degreesOfFreedomNotPositive: /*i18n*/ {
    id: 'refusal.degreesOfFreedomNotPositive',
    message: 'degrees of freedom must be positive',
  },
  degreesOfFreedomNotPositiveWhole: /*i18n*/ {
    id: 'refusal.degreesOfFreedomNotPositiveWhole',
    message: 'degrees of freedom must be a positive whole number',
  },
  maxIterationsNotPositiveInteger: /*i18n*/ {
    id: 'refusal.maxIterationsNotPositiveInteger',
    message: 'maxIterations must be a positive integer',
  },
  maxConditionOutOfRange: /*i18n*/ {
    id: 'refusal.maxConditionOutOfRange',
    message: 'maxCondition must be finite and at least 1',
  },
  velocitiesNotFinite: /*i18n*/ {
    id: 'refusal.velocitiesNotFinite',
    message: 'velocities must be finite',
  },
  relativeHalfWidthBelowMinimum: /*i18n*/ {
    id: 'refusal.relativeHalfWidthBelowMinimum',
    message: 'relative half-width must be at least 0.01',
  },
  relativeHalfWidthOutOfReach: /*i18n*/ {
    id: 'refusal.relativeHalfWidthOutOfReach',
    message: 'relative half-width needs more shots than the search covers',
  },
} satisfies Record<StatisticsIssue['code'], Described>

const groupStatisticsWords = {
  'confidence-level': /*i18n*/ {
    id: 'refusal.confidenceLevel',
    message: 'confidence level must lie in (0, 1)',
  },
  distance: /*i18n*/ { id: 'refusal.distance', message: 'distance must be positive' },
  'shot-coordinates': /*i18n*/ {
    id: 'refusal.shotCoordinates',
    message: 'shot coordinates must be finite',
  },
  'shot-velocity': /*i18n*/ { id: 'refusal.shotVelocity', message: 'shot velocity must be finite' },
  aim: /*i18n*/ { id: 'refusal.aim', message: 'aim must be finite' },
  coverage: /*i18n*/ { id: 'refusal.coverage', message: 'coverage must lie in (0, 1)' },
} satisfies Record<GroupStatisticsIssue['code'], Described>

const exteriorWords = {
  pressureInvalid: /*i18n*/ { id: 'refusal.pressureInvalid', message: 'pressure {pressure} Pa' },
  humidityOutsideUnit: /*i18n*/ {
    id: 'refusal.humidityOutsideUnit',
    message: 'humidity {humidity} outside 0..1',
  },
  temperatureInvalid: /*i18n*/ {
    id: 'refusal.temperatureInvalid',
    message: 'temperature {temperature} K',
  },
  altitudeOutsideRange: /*i18n*/ {
    id: 'refusal.altitudeOutsideRange',
    message: 'altitude {altitude} m outside {low} to {high} m',
  },
  timeOfFlightNegative: /*i18n*/ {
    id: 'refusal.timeOfFlightNegative',
    message: 'time of flight must be 0 or more',
  },
  rangeNotPositive: /*i18n*/ { id: 'refusal.rangeNotPositive', message: 'range must be positive' },
  targetHeadingNotNumber: /*i18n*/ {
    id: 'refusal.targetHeadingNotNumber',
    message: 'target heading must be a number',
  },
  targetSpeedNegative: /*i18n*/ {
    id: 'refusal.targetSpeedNegative',
    message: 'target speed must be 0 or more',
  },
  muzzleVelocityNotConverged: /*i18n*/ {
    id: 'refusal.muzzleVelocityNotConverged',
    message: 'muzzle velocity did not converge',
  },
  measuredSpeedTooLow: /*i18n*/ {
    id: 'refusal.measuredSpeedTooLow',
    message: 'the speed measured is lower than the bullet can keep over the distance',
  },
  distanceNotReached: /*i18n*/ {
    id: 'refusal.distanceNotReached',
    message: 'distance {distance} m not reached ({stop})',
  },
  velocityNotPositive: /*i18n*/ {
    id: 'refusal.velocityNotPositive',
    message: 'velocity must be positive',
  },
  distanceNegative: /*i18n*/ {
    id: 'refusal.distanceNegative',
    message: 'distance must not be negative',
  },
  outlineOutsideMethod: /*i18n*/ {
    id: 'refusal.outlineOutsideMethod',
    message: 'the outline gives no positive finite drag: outside the method',
  },
  machNotPositive: /*i18n*/ { id: 'refusal.machNotPositive', message: 'mach must be positive' },
  diameterNotPositive: /*i18n*/ {
    id: 'refusal.diameterNotPositive',
    message: 'diameter must be positive',
  },
  noseAndBoatTailExceedLength: /*i18n*/ {
    id: 'refusal.noseAndBoatTailExceedLength',
    message: 'noseLength plus boatTailLength must not exceed length',
  },
  bandDiameterBelowDiameter: /*i18n*/ {
    id: 'refusal.bandDiameterBelowDiameter',
    message: 'bandDiameter must be at least the diameter',
  },
  meplatDiameterOutsideRange: /*i18n*/ {
    id: 'refusal.meplatDiameterOutsideRange',
    message: 'meplatDiameter must be zero up to the diameter',
  },
  baseDiameterNotPositive: /*i18n*/ {
    id: 'refusal.baseDiameterNotPositive',
    message: 'baseDiameter must be positive',
  },
  boatTailLengthNegative: /*i18n*/ {
    id: 'refusal.boatTailLengthNegative',
    message: 'boatTailLength must be zero or more',
  },
  headShapeOutsideUnit: /*i18n*/ {
    id: 'refusal.headShapeOutsideUnit',
    message: 'headShape must be from 0 to 1',
  },
  outlineLengthsNotPositive: /*i18n*/ {
    id: 'refusal.outlineLengthsNotPositive',
    message: 'length and noseLength must be positive',
  },
  noCandidate: /*i18n*/ { id: 'refusal.noCandidate', message: 'at least one candidate' },
  dispersionNotPositive: /*i18n*/ {
    id: 'refusal.dispersionNotPositive',
    message: 'dispersion must be positive',
  },
  entryValueInvalid: /*i18n*/ { id: 'refusal.entryValueInvalid', message: 'entry value' },
  entryKindUnknown: /*i18n*/ { id: 'refusal.entryKindUnknown', message: 'entry kind {kind}' },
  noEntryOrChronograph: /*i18n*/ {
    id: 'refusal.noEntryOrChronograph',
    message: 'at least one entry or a chronograph',
  },
  chronographMeanInvalid: /*i18n*/ {
    id: 'refusal.chronographMeanInvalid',
    message: 'chronograph mean',
  },
  entryRoundingNegative: /*i18n*/ {
    id: 'refusal.entryRoundingNegative',
    message: '{kind} rounding must not be negative',
  },
  entryStandardDeviationNotPositive: /*i18n*/ {
    id: 'refusal.entryStandardDeviationNotPositive',
    message: '{kind} standardDeviation must be positive',
  },
  entryShotCountInvalid: /*i18n*/ {
    id: 'refusal.entryShotCountInvalid',
    message: '{kind} shotCount must be a whole number of at least 1',
  },
  entryRangeInvalid: /*i18n*/ { id: 'refusal.entryRangeInvalid', message: '{kind} range' },
  maxRelativeStandardUncertaintyNotPositive: /*i18n*/ {
    id: 'refusal.maxRelativeStandardUncertaintyNotPositive',
    message: 'maxRelativeStandardUncertainty must be positive',
  },
  maxInflationNotAboveOne: /*i18n*/ {
    id: 'refusal.maxInflationNotAboveOne',
    message: 'maxInflation must exceed 1',
  },
  residualConfidenceLevelOutsideUnit: /*i18n*/ {
    id: 'refusal.residualConfidenceLevelOutsideUnit',
    message: 'residualConfidenceLevel must lie in (0, 1)',
  },
  confidenceLevelOptionOutsideUnit: /*i18n*/ {
    id: 'refusal.confidenceLevelOptionOutsideUnit',
    message: 'confidenceLevel must lie in (0, 1)',
  },
  zeroOffsetPriorWithoutFit: /*i18n*/ {
    id: 'refusal.zeroOffsetPriorWithoutFit',
    message: 'a zeroOffset prior needs the fitZeroOffset option',
  },
  priorNotPositive: /*i18n*/ {
    id: 'refusal.priorNotPositive',
    message: 'prior {name} must be positive',
  },
  priorUnknown: /*i18n*/ { id: 'refusal.priorUnknown', message: 'prior {name}' },
  clickValueNotPositive: /*i18n*/ {
    id: 'refusal.clickValueNotPositive',
    message: 'click value must be positive',
  },
  maxZeroSigmaNotPositive: /*i18n*/ {
    id: 'refusal.maxZeroSigmaNotPositive',
    message: 'maxZeroSigma must be positive',
  },
  muzzleVelocityNotPositive: /*i18n*/ {
    id: 'refusal.muzzleVelocityNotPositive',
    message: 'muzzle velocity must be positive',
  },
  stepSizeBelowMinimum: /*i18n*/ {
    id: 'refusal.stepSizeBelowMinimum',
    message: 'step size {step} s below {min} s',
  },
  integrationBudgetExceeded: /*i18n*/ {
    id: 'refusal.integrationBudgetExceeded',
    message: 'more than {max} integration steps in total',
  },
  integrationStepsExceeded: /*i18n*/ {
    id: 'refusal.integrationStepsExceeded',
    message: 'more than {max} integration steps',
  },
  stabilityInputsNotPositive: /*i18n*/ {
    id: 'refusal.stabilityInputsNotPositive',
    message: 'mass, diameter, length, twist and velocity must be positive',
  },
  rangeInvalid: /*i18n*/ { id: 'refusal.rangeInvalid', message: 'range {range}' },
  zeroNotConverged: /*i18n*/ {
    id: 'refusal.zeroNotConverged',
    message: 'zero did not converge (miss {vertical} m, {horizontal} m)',
  },
  zeroRangeNotReached: /*i18n*/ {
    id: 'refusal.zeroRangeNotReached',
    message: 'zero range {range} m not reached ({stop})',
  },
  momentSlopeNotPositive: /*i18n*/ {
    id: 'refusal.momentSlopeNotPositive',
    message: 'momentSlope must be positive (spin-stabilized bullet)',
  },
  momentSlopeNeedsLength: /*i18n*/ {
    id: 'refusal.momentSlopeNeedsLength',
    message: 'a missing momentSlope needs the length',
  },
  inertiaNotPositive: /*i18n*/ {
    id: 'refusal.inertiaNotPositive',
    message: 'moments of inertia must be positive',
  },
  inertiaNeedsLength: /*i18n*/ {
    id: 'refusal.inertiaNeedsLength',
    message: 'a missing moment of inertia needs the length',
  },
  modifiedPointMassNeedsLiftSlope: /*i18n*/ {
    id: 'refusal.modifiedPointMassNeedsLiftSlope',
    message: 'the modified point mass needs liftSlope',
  },
  modifiedPointMassNeedsTwist: /*i18n*/ {
    id: 'refusal.modifiedPointMassNeedsTwist',
    message: 'the modified point mass needs twist and twist hand',
  },
  modifiedPointMassNeedsAerodynamics: /*i18n*/ {
    id: 'refusal.modifiedPointMassNeedsAerodynamics',
    message: 'the modified point mass needs projectile.aerodynamics',
  },
  coefficientTableMachNotRising: /*i18n*/ {
    id: 'refusal.coefficientTableMachNotRising',
    message: '{name} table Mach must rise',
  },
  coefficientTableNodeInvalid: /*i18n*/ {
    id: 'refusal.coefficientTableNodeInvalid',
    message: '{name} table node',
  },
  coefficientTableTooShort: /*i18n*/ {
    id: 'refusal.coefficientTableTooShort',
    message: '{name} table needs at least two nodes',
  },
  coefficientNotFinite: /*i18n*/ {
    id: 'refusal.coefficientNotFinite',
    message: '{name} must be finite',
  },
  modelUnknown: /*i18n*/ { id: 'refusal.modelUnknown', message: 'model {model}' },
  zeroToleranceOrMaxYawNotPositive: /*i18n*/ {
    id: 'refusal.zeroToleranceOrMaxYawNotPositive',
    message: 'zero tolerance and maximum yaw must be positive',
  },
  gravityInvalid: /*i18n*/ { id: 'refusal.gravityInvalid', message: 'gravity' },
  stepBudgetInvalid: /*i18n*/ { id: 'refusal.stepBudgetInvalid', message: 'step budget' },
  tolerancesInvalid: /*i18n*/ { id: 'refusal.tolerancesInvalid', message: 'tolerances and limits' },
  azimuthInvalid: /*i18n*/ { id: 'refusal.azimuthInvalid', message: 'azimuth' },
  latitudeInvalid: /*i18n*/ { id: 'refusal.latitudeInvalid', message: 'latitude' },
  lookAngleOutsideRange: /*i18n*/ {
    id: 'refusal.lookAngleOutsideRange',
    message: 'look angle outside -pi/2..pi/2',
  },
  boreAnglesInvalid: /*i18n*/ { id: 'refusal.boreAnglesInvalid', message: 'bore angles' },
  zeroLookAngleOutsideRange: /*i18n*/ {
    id: 'refusal.zeroLookAngleOutsideRange',
    message: 'zero look angle outside -pi/2..pi/2',
  },
  zeroRangeNotPositive: /*i18n*/ {
    id: 'refusal.zeroRangeNotPositive',
    message: 'zero range must be positive',
  },
  twistNotPositive: /*i18n*/ { id: 'refusal.twistNotPositive', message: 'twist must be positive' },
  sightInvalid: /*i18n*/ { id: 'refusal.sightInvalid', message: 'sight height and offset' },
  lengthNotPositive: /*i18n*/ {
    id: 'refusal.lengthNotPositive',
    message: 'length must be positive',
  },
  massNotPositive: /*i18n*/ { id: 'refusal.massNotPositive', message: 'mass must be positive' },
  dragInterpolationUnknown: /*i18n*/ {
    id: 'refusal.dragInterpolationUnknown',
    message: 'drag interpolation {interpolation}',
  },
  dragCurveMachNotRising: /*i18n*/ {
    id: 'refusal.dragCurveMachNotRising',
    message: 'drag curve Mach must rise',
  },
  dragCurveNodeInvalid: /*i18n*/ { id: 'refusal.dragCurveNodeInvalid', message: 'drag curve node' },
  dragCurveTooShort: /*i18n*/ {
    id: 'refusal.dragCurveTooShort',
    message: 'a drag curve needs at least two nodes',
  },
  bcReferenceUnknown: /*i18n*/ {
    id: 'refusal.bcReferenceUnknown',
    message: 'BC reference {reference}',
  },
  bcBandsSameSpeed: /*i18n*/ {
    id: 'refusal.bcBandsSameSpeed',
    message: 'BC bands need distinct speeds',
  },
  bcBandInvalid: /*i18n*/ { id: 'refusal.bcBandInvalid', message: 'BC band' },
  noBcBand: /*i18n*/ { id: 'refusal.noBcBand', message: 'at least one BC band' },
  dragModelUnknown: /*i18n*/ { id: 'refusal.dragModelUnknown', message: 'drag model {model}' },
  windSegmentsNotRising: /*i18n*/ {
    id: 'refusal.windSegmentsNotRising',
    message: 'wind segments must end in rising order',
  },
  windSegmentInvalid: /*i18n*/ { id: 'refusal.windSegmentInvalid', message: 'wind segment' },
  sessionWithoutObservation: /*i18n*/ {
    id: 'refusal.sessionWithoutObservation',
    message: 'at least one observation per session',
  },
  noSession: /*i18n*/ { id: 'refusal.noSession', message: 'at least one session' },
  knotsNeedSingleBandOrCurve: /*i18n*/ {
    id: 'refusal.knotsNeedSingleBandOrCurve',
    message: 'knots need a single-band BC or a curve',
  },
  knotsNotRising: /*i18n*/ { id: 'refusal.knotsNotRising', message: 'knots must rise' },
  knotMachNotPositive: /*i18n*/ {
    id: 'refusal.knotMachNotPositive',
    message: 'knot Mach must be positive',
  },
  knotsTooFew: /*i18n*/ { id: 'refusal.knotsTooFew', message: 'at least two knots' },
  mixedObservationsNeedUncertainty: /*i18n*/ {
    id: 'refusal.mixedObservationsNeedUncertainty',
    message: 'observations of different kinds need standard uncertainties',
  },
  standardUncertaintyPartial: /*i18n*/ {
    id: 'refusal.standardUncertaintyPartial',
    message: 'standardUncertainty on all observations or none',
  },
  standardUncertaintyNotPositive: /*i18n*/ {
    id: 'refusal.standardUncertaintyNotPositive',
    message: 'standardUncertainty must be positive',
  },
  observationRangeInvalid: /*i18n*/ {
    id: 'refusal.observationRangeInvalid',
    message: 'observation range {range}',
  },
  observationValueInvalid: /*i18n*/ {
    id: 'refusal.observationValueInvalid',
    message: 'observation value',
  },
  observationKindUnknown: /*i18n*/ {
    id: 'refusal.observationKindUnknown',
    message: 'observation kind {kind}',
  },
  noObservation: /*i18n*/ { id: 'refusal.noObservation', message: 'at least one observation' },
  maxTotalStepsNotPositive: /*i18n*/ {
    id: 'refusal.maxTotalStepsNotPositive',
    message: 'maxTotalSteps must be positive',
  },
  airDensityOutsideRange: /*i18n*/ {
    id: 'refusal.airDensityOutsideRange',
    message:
      'pressure {pressure} Pa at temperature {temperature} K gives an air density of {density} kg/m3, outside 0 to {max} kg/m3',
  },
  groupSharesShots: /*i18n*/ {
    id: 'refusal.groupSharesShots',
    message:
      'group {group}: an impact and a dial entry share their shots, keep one or name two groups',
  },
  rangeNotReached: /*i18n*/ {
    id: 'refusal.rangeNotReached',
    message: 'range {range} m not reached',
  },
  rangeGroupSharesShots: /*i18n*/ {
    id: 'refusal.rangeGroupSharesShots',
    message:
      'group {range} m: an impact and a dial entry share their shots, keep one or name two groups',
  },
} satisfies Record<ExteriorIssue['code'], Described>

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
    'parameters: burnRate, temperatureFactor, energy, each at most once, burnRate always',
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
  valueMissing: /*i18n*/ { id: 'refusal.valueMissing', message: 'Enter a number for {field}.' },
  valueNegative: /*i18n*/ { id: 'refusal.valueNegative', message: '{field} must be at least 0.' },
  burnFormPartial: /*i18n*/ {
    id: 'refusal.burnFormPartial',
    message: 'Burn form: {missing} needed with the others, or leave all four empty.',
  },
  valueNotNumber: /*i18n*/ { id: 'refusal.valueNotNumber', message: 'Enter a number.' },
  valueNotPositive: /*i18n*/ { id: 'refusal.valueNotPositive', message: 'Must be above 0.' },
  valueBelowZero: /*i18n*/ { id: 'refusal.valueBelowZero', message: 'Must be at least 0.' },
  engravingValueNeeded: /*i18n*/ {
    id: 'refusal.engravingValueNeeded',
    message: 'Needed with the other engraving value, or from a powder record.',
  },
} satisfies Record<LoadFileIssue['code'], Described>

const useCaseWords = {
  resultNotFinite: /*i18n*/ {
    id: 'refusal.resultNotFinite',
    message: 'result holds a non-finite number at {path}',
  },
  powderBulkDensityOutOfRange: /*i18n*/ {
    id: 'refusal.powderBulkDensityOutOfRange',
    message: 'powder {powder} bulk density {density} kg/m3 must be above 0 and at most {max} kg/m3',
  },
  powderWithoutBulkDensity: /*i18n*/ {
    id: 'refusal.powderWithoutBulkDensity',
    message: 'powder {powder} has no bulk density',
  },
  bulletWithoutDiameter: /*i18n*/ {
    id: 'refusal.bulletWithoutDiameter',
    message: 'bullet {bullet} has no diameter',
  },
  bulletWithoutLength: /*i18n*/ {
    id: 'refusal.bulletWithoutLength',
    message: 'bullet {bullet} has no length',
  },
  bulletValueOutOfBounds: /*i18n*/ {
    id: 'refusal.bulletValueOutOfBounds',
    message: 'bullet {bullet} {key} {value} {unit} must be within {low} and {high} {unit}',
  },
  bulletWithoutCoefficient: /*i18n*/ {
    id: 'refusal.bulletWithoutCoefficient',
    message: 'bullet {bullet} has no {model} ballistic coefficient',
  },
  bulletCoefficientsWithoutBands: /*i18n*/ {
    id: 'refusal.bulletCoefficientsWithoutBands',
    message:
      'bullet {bullet} has {count} {model} values without distinct velocity bands; send drag explicitly',
  },
  ladderChargeNotAboveZero: /*i18n*/ {
    id: 'refusal.ladderChargeNotAboveZero',
    message: 'ladder charge {charge} g must be above 0',
  },
  recordNotFound: /*i18n*/ { id: 'refusal.recordNotFound', message: '{kind} {id} not found' },
} satisfies Record<(UseCaseIssue | RecordNotFoundIssue)['code'], Described>

/** Joins two packages' words; a code both use fails `tsc`, since a refusal carries no package. */
const disjoint = <L extends object, R extends object>(
  l: L,
  r: R & { [K in keyof L & keyof R]: never },
) => ({ ...l, ...r })

/** The words of every code. */
export const refusalWords: Readonly<Record<string, Described | Message>> = disjoint(
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

/** A list joined by commas, the pressure rows counted per basis, a number as JavaScript writes it; a load file field arrives labeled (`interior-input.ts`). */
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
  return words && english.t(typeof words === 'string' ? words : (words.message as Message), values)
}
