// the ballistics models, their fits and the options bags, moved to their own package
export * from '@open-reloading/ballistics'
// the statistics this package exported before they moved to their own package
export {
  chiSquareCdf,
  chiSquareQuantile,
  chiSquareSurvival,
  fQuantileTwoNumeratorDegrees,
  type Identifiability,
  type Interval,
  identifiability,
  type LogFitFailure,
  type LogFitInput,
  type LogFitResult,
  type LogFitStop,
  logLeastSquares,
  shotsNeeded,
  type VelocityStatistics,
  velocityStatistics,
} from '@open-reloading/statistics'
// the water density of a case capacity, kept in the export for the callers of core
export { waterDensityGramsPerCm3 } from '@open-reloading/units'
export * from './advisories.ts'
export { InputError } from './errors.ts'
export * from './groups/statistics.ts'
