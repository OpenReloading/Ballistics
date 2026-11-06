import { type Arbitrary, array, double, integer } from 'fast-check'

/** A probability or confidence level strictly between 0 and 1. */
export const probability = (): Arbitrary<number> =>
  double({ min: 0, max: 1, minExcluded: true, maxExcluded: true, noNaN: true })

/** A finite number in (0, `max`]. */
export const positive = (max: number): Arbitrary<number> =>
  double({ min: 0, max, minExcluded: true, noNaN: true })

/** Degrees of freedom of a distribution: a whole number from 1 to `max`. */
export const degreesOfFreedom = (max: number): Arbitrary<number> => integer({ min: 1, max })

/** A string of `minShots` to `maxShots` muzzle velocities, m/s, between 100 and 1500. */
export const velocities = (minShots: number, maxShots: number): Arbitrary<number[]> =>
  array(double({ min: 100, max: 1500, noNaN: true }), {
    minLength: minShots,
    maxLength: maxShots,
  })
