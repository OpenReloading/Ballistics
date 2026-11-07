// the exterior models, the drag tables and the options bags, moved to their own package
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
export * from './interior/curve-fit.ts'
export * from './interior/fit.ts'
export * from './interior/fit-confidence.ts'
export * from './interior/fit-pooled.ts'
export * from './interior/fit-sessions.ts'
export * from './interior/fit-strings.ts'
