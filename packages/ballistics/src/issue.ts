import {
  type Diagnostic,
  need as needAny,
  InputError as StatisticsInputError,
} from '@open-reloading/statistics'

/** Why an exterior function refuses its input or stops. */
export type ExteriorIssue =
  | Diagnostic<'pressureInvalid', { pressure: number }>
  | Diagnostic<'humidityOutsideUnit', { humidity: number }>
  | Diagnostic<'temperatureInvalid', { temperature: number }>
  | Diagnostic<'altitudeOutsideRange', { altitude: number; low: number; high: number }>
  | Diagnostic<'timeOfFlightNegative'>
  | Diagnostic<'rangeNotPositive'>
  | Diagnostic<'targetHeadingNotNumber'>
  | Diagnostic<'targetSpeedNegative'>
  | Diagnostic<'muzzleVelocityNotConverged'>
  | Diagnostic<'measuredSpeedTooLow'>
  | Diagnostic<'distanceNotReached', { distance: number; stop: string }>
  | Diagnostic<'velocityNotPositive'>
  | Diagnostic<'distanceNegative'>
  | Diagnostic<'outlineOutsideMethod'>
  | Diagnostic<'machNotPositive'>
  | Diagnostic<'diameterNotPositive'>
  | Diagnostic<'noseAndBoatTailExceedLength'>
  | Diagnostic<'bandDiameterBelowDiameter'>
  | Diagnostic<'meplatDiameterOutsideRange'>
  | Diagnostic<'baseDiameterNotPositive'>
  | Diagnostic<'boatTailLengthNegative'>
  | Diagnostic<'headShapeOutsideUnit'>
  | Diagnostic<'outlineLengthsNotPositive'>
  | Diagnostic<'noCandidate'>
  | Diagnostic<'dispersionNotPositive'>
  | Diagnostic<'entryValueInvalid'>
  | Diagnostic<'entryKindUnknown', { kind: string }>
  | Diagnostic<'noEntryOrChronograph'>
  | Diagnostic<'chronographMeanInvalid'>
  | Diagnostic<'entryRoundingNegative', { kind: string }>
  | Diagnostic<'entryStandardDeviationNotPositive', { kind: string }>
  | Diagnostic<'entryShotCountInvalid', { kind: string }>
  | Diagnostic<'entryRangeInvalid', { kind: string }>
  | Diagnostic<'maxRelativeStandardUncertaintyNotPositive'>
  | Diagnostic<'maxInflationNotAboveOne'>
  | Diagnostic<'residualConfidenceLevelOutsideUnit'>
  | Diagnostic<'confidenceLevelOptionOutsideUnit'>
  | Diagnostic<'zeroOffsetPriorWithoutFit'>
  | Diagnostic<'priorNotPositive', { name: string }>
  | Diagnostic<'priorUnknown', { name: string }>
  | Diagnostic<'clickValueNotPositive'>
  | Diagnostic<'maxZeroSigmaNotPositive'>
  | Diagnostic<'muzzleVelocityNotPositive'>
  | Diagnostic<'stepSizeBelowMinimum', { step: number; min: number }>
  | Diagnostic<'integrationBudgetExceeded', { max: number }>
  | Diagnostic<'integrationStepsExceeded', { max: number }>
  | Diagnostic<'stabilityInputsNotPositive'>
  | Diagnostic<'rangeInvalid', { range: number }>
  | Diagnostic<'zeroNotConverged', { vertical: number; horizontal: number }>
  | Diagnostic<'zeroRangeNotReached', { range: number; stop: string }>
  | Diagnostic<'momentSlopeNotPositive'>
  | Diagnostic<'momentSlopeNeedsLength'>
  | Diagnostic<'inertiaNotPositive'>
  | Diagnostic<'inertiaNeedsLength'>
  | Diagnostic<'modifiedPointMassNeedsLiftSlope'>
  | Diagnostic<'modifiedPointMassNeedsTwist'>
  | Diagnostic<'modifiedPointMassNeedsAerodynamics'>
  | Diagnostic<'coefficientTableMachNotRising', { name: string }>
  | Diagnostic<'coefficientTableNodeInvalid', { name: string }>
  | Diagnostic<'coefficientTableTooShort', { name: string }>
  | Diagnostic<'coefficientNotFinite', { name: string }>
  | Diagnostic<'modelUnknown', { model: string }>
  | Diagnostic<'zeroToleranceOrMaxYawNotPositive'>
  | Diagnostic<'gravityInvalid'>
  | Diagnostic<'stepBudgetInvalid'>
  | Diagnostic<'tolerancesInvalid'>
  | Diagnostic<'azimuthInvalid'>
  | Diagnostic<'latitudeInvalid'>
  | Diagnostic<'lookAngleOutsideRange'>
  | Diagnostic<'boreAnglesInvalid'>
  | Diagnostic<'zeroLookAngleOutsideRange'>
  | Diagnostic<'zeroRangeNotPositive'>
  | Diagnostic<'twistNotPositive'>
  | Diagnostic<'sightInvalid'>
  | Diagnostic<'lengthNotPositive'>
  | Diagnostic<'massNotPositive'>
  | Diagnostic<'dragInterpolationUnknown', { interpolation: string }>
  | Diagnostic<'dragCurveMachNotRising'>
  | Diagnostic<'dragCurveNodeInvalid'>
  | Diagnostic<'dragCurveTooShort'>
  | Diagnostic<'bcReferenceUnknown', { reference: string }>
  | Diagnostic<'bcBandsSameSpeed'>
  | Diagnostic<'bcBandInvalid'>
  | Diagnostic<'noBcBand'>
  | Diagnostic<'dragModelUnknown', { model: string }>
  | Diagnostic<'windSegmentsNotRising'>
  | Diagnostic<'windSegmentInvalid'>
  | Diagnostic<'sessionWithoutObservation'>
  | Diagnostic<'noSession'>
  | Diagnostic<'knotsNeedSingleBandOrCurve'>
  | Diagnostic<'knotsNotRising'>
  | Diagnostic<'knotMachNotPositive'>
  | Diagnostic<'knotsTooFew'>
  | Diagnostic<'mixedObservationsNeedUncertainty'>
  | Diagnostic<'standardUncertaintyPartial'>
  | Diagnostic<'standardUncertaintyNotPositive'>
  | Diagnostic<'observationRangeInvalid', { range: number }>
  | Diagnostic<'observationValueInvalid'>
  | Diagnostic<'observationKindUnknown', { kind: string }>
  | Diagnostic<'noObservation'>
  | Diagnostic<'maxTotalStepsNotPositive'>
  | Diagnostic<
      'airDensityOutsideRange',
      { pressure: number; temperature: number; density: number; max: number }
    >
  | Diagnostic<'groupSharesShots', { group: string }>
  | Diagnostic<'rangeGroupSharesShots', { range: number }>
  /** A trajectory of a truing fit that ends before a range of the rows. */
  | Diagnostic<'rangeNotReached', { range: number }>

/** Why an interior function, a fit, a ladder or the free recoil refuses its input. */
export type InteriorIssue =
  | Diagnostic<'gasVelocityFactorNegative'>
  | Diagnostic<'muzzleVelocityNegative'>
  | Diagnostic<'chargeMassNegative'>
  | Diagnostic<'projectileMassNotPositive'>
  | Diagnostic<'firearmMassNotPositive'>
  | Diagnostic<'loadRatioTargetNeedsBulkDensity'>
  | Diagnostic<'bulkDensityNotPositive'>
  | Diagnostic<'targetValueNotPositive'>
  | Diagnostic<'modelLeavesBarrelBeforeWindowEnd'>
  | Diagnostic<'traceWindowTooShort'>
  | Diagnostic<'traceNoPositivePressure'>
  | Diagnostic<'sigmaPartial'>
  | Diagnostic<'chargeNotPositive'>
  | Diagnostic<'noTrace'>
  | Diagnostic<'curveFitNeedsTwoStageVivacity'>
  | Diagnostic<'fallFractionOutsideUnit'>
  | Diagnostic<'exponentStartNotPositive'>
  | Diagnostic<'transitionStartNotBelowOne'>
  | Diagnostic<'formSlopeStartNotPositive'>
  | Diagnostic<'curveFitParametersInvalid'>
  | Diagnostic<'sigmaNotPositive'>
  | Diagnostic<'traceSensorUnknown'>
  | Diagnostic<'traceInvalid'>
  | Diagnostic<'traceNeverFalls'>
  | Diagnostic<'rangeWithoutWidth'>
  | Diagnostic<'countNotPositiveInteger'>
  | Diagnostic<'burnCoefficientOrEnergyNotPositive'>
  | Diagnostic<'noPoint'>
  | Diagnostic<'inputUncertaintyNegative', { input: string }>
  | Diagnostic<'noHeldOutString'>
  | Diagnostic<'velocitySigmaMissing'>
  | Diagnostic<'targetPowderNotInFit'>
  | Diagnostic<'velocitySigmaNegative'>
  | Diagnostic<'levelOutsideUnit'>
  | Diagnostic<'pooledFitNoCovariance'>
  | Diagnostic<'groupPriorNotPositive', { kind: string; group: string }>
  | Diagnostic<'priorPowderNotInSessions'>
  | Diagnostic<'sessionsBurnKindDiffers'>
  | Diagnostic<'barrelOrTemperatureOnPoint'>
  | Diagnostic<'pooledFitVelocitiesOnly'>
  | Diagnostic<'ladderChargeOrVelocityNotPositive'>
  | Diagnostic<'propellantTemperatureNotPositive'>
  | Diagnostic<'barrelLengthNotPositive'>
  | Diagnostic<'sessionWithoutLadderPoint'>
  | Diagnostic<'rifleOrLotSigmaNotPositive'>
  | Diagnostic<'pooledFitParametersInvalid'>
  | Diagnostic<'noSession'>
  | Diagnostic<'priorParameterNotFitted'>
  | Diagnostic<'burnCoefficientNotFitted'>
  | Diagnostic<'stringWithoutVelocity'>
  | Diagnostic<'fitNoCovariance'>
  | Diagnostic<'boreDiameterNotPositive'>
  | Diagnostic<'startPressureTooLow'>
  | Diagnostic<'domainMarginOutsideRange'>
  | Diagnostic<'priorsNeedVelocitySigmas'>
  | Diagnostic<'huberThresholdNotPositive'>
  | Diagnostic<'temperatureFactorNeedsSensitivity'>
  | Diagnostic<'fitParametersInvalid', { parameters: string[] }>
  | Diagnostic<'pressuresNeedVelocitySigmas'>
  | Diagnostic<'velocitySigmaPartial'>
  | Diagnostic<'pressureBasisUnknown', { bases: string[] }>
  | Diagnostic<'pressureWithoutBasis'>
  | Diagnostic<'pressureWithoutSigma'>
  | Diagnostic<'pressureSigmaNotPositive'>
  | Diagnostic<'ladderPressureNotPositive'>
  | Diagnostic<'velocitySigmaNotPositive'>
  | Diagnostic<'ladderVelocityNotPositive'>
  | Diagnostic<'ladderChargeNotPositive'>
  | Diagnostic<'noLadderPoint'>
  | Diagnostic<'heightsOrVelocitiesNotFinite'>
  | Diagnostic<'shotWithoutHeightOrVelocity'>
  | Diagnostic<'chargeTooFewShots'>
  | Diagnostic<'slopeNotFinite'>
  | Diagnostic<'ladderTooFewCharges'>
  | Diagnostic<'ladderLowestChargeNotPositive', { charge: number }>
  | Diagnostic<'ladderAroundNeedsOddCount'>
  | Diagnostic<'ladderStepCountInvalid'>
  | Diagnostic<'ladderStepNotPositive'>
  | Diagnostic<'ladderStartNotPositive'>
  | Diagnostic<'boreResistanceNeedsValues', { missing: string[] }>
  | Diagnostic<'powderWithoutInteriorModel'>
  | Diagnostic<'bulletConstructionUnknown', { construction: string }>
  | Diagnostic<'barrelNotPositive', { barrel: number }>
  | Diagnostic<'ladderTooFewStrings'>
  | Diagnostic<'chargesEqual'>
  | Diagnostic<'stringTooFewShots'>
  | Diagnostic<'standardDeviationNegative'>
  | Diagnostic<'meanNotFinite'>
  | Diagnostic<'dynamicVivacityRangeInvalid'>
  | Diagnostic<'dynamicVivacityExponentNotOne'>
  | Diagnostic<'priorValueOrSigmaNotPositive', { name: string }>
  | Diagnostic<'priorValueBelowFloorOrSigmaNotPositive', { name: string }>

/** Why a function of this package refuses its input. */
export type BallisticsIssue = ExteriorIssue | InteriorIssue

/** `need` of `@open-reloading/statistics` with an issue of this package. */
export const need: (ok: boolean, issue: BallisticsIssue) => void = needAny

/** The `InputError` of `@open-reloading/statistics`, raised with an issue of this package. */
export const InputError: new (issue: BallisticsIssue) => StatisticsInputError = StatisticsInputError
