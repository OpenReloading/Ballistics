import { normalsFrom, seededUniforms } from '@open-reloading/statistics'

/** Deterministic standard normal numbers: the Monte Carlo generator through Box-Muller. */
export const normals = (seed: number): (() => number) => normalsFrom(seededUniforms(seed))
