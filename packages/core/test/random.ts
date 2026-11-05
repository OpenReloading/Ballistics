import { seededUniforms } from '@open-reloading/statistics'
import { normalsFrom } from '@open-reloading/test-kit'

/** Deterministic uniform numbers in [0, 1): the mulberry32 generator the Monte Carlo runs draw from. */
export const uniforms = seededUniforms

/** Deterministic standard normal numbers: mulberry32 uniforms through Box-Muller. */
export const normals = (seed: number): (() => number) => normalsFrom(uniforms(seed))
