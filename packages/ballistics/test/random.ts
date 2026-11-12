import { normalsFrom, seededUniforms } from '@rangefoundry/statistics'

/** Deterministic standard normal numbers: the Monte Carlo generator through Box-Muller. */
export const normals = (seed: number): (() => number) => normalsFrom(seededUniforms(seed))
