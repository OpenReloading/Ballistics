import { type Arbitrary, integer, noBias, sample, tuple } from 'fast-check'

const span = 2 ** 32

/** A number uniform in [0, 1): an unbiased 32-bit integer over 2^32. */
const unit = (): Arbitrary<number> =>
  noBias(integer({ min: 0, max: span - 1 })).map((i) => i / span)

/** One standard normal number from two uniforms (Box-Muller): the radius from `u1`, the angle from `u2`. */
const boxMuller = (u1: number, u2: number) =>
  Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2)

/** `count` numbers uniform in [0, 1): the same numbers for the same `seed`. */
export function uniforms(seed: number, count: number): number[] {
  return sample(unit(), { seed, numRuns: count })
}

/**
 * Standard normal numbers drawn from `uniform` by Box-Muller, two uniforms each:
 * `normalsFrom(seededUniforms(seed))` repeats the draws of a model's own generator.
 */
export function normalsFrom(uniform: () => number): () => number {
  return () => boxMuller(uniform(), uniform())
}

/** `count` standard normal numbers: the same numbers for the same `seed`. */
export function normals(seed: number, count: number): number[] {
  return sample(tuple(unit(), unit()), { seed, numRuns: count }).map(([u1, u2]) =>
    boxMuller(u1, u2),
  )
}
