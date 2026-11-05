/** How far a number may lie from the expected one: `relative` to the expected size, plus `absolute`. */
export interface Tolerance {
  relative?: number
  absolute?: number
}

/** Whether `actual` lies within `tolerance` of `expected`: |actual - expected| at most relative |expected| + absolute. */
export function within(actual: number, expected: number, tolerance: Tolerance): boolean {
  const { relative = 0, absolute = 0 } = tolerance
  return Math.abs(actual - expected) <= relative * Math.abs(expected) + absolute
}

/** A tolerance matcher in a Vitest equality (`toEqual`, `toStrictEqual`, `toMatchObject`). */
export interface Near {
  readonly $$typeof: symbol
  asymmetricMatch(actual: unknown): boolean
  toAsymmetricMatcher(): string
}

/**
 * Matches a finite number within `tolerance` of `expected`, also inside objects and arrays:
 * `expect(result).toEqual({ mean: near(812.3, { relative: 1e-12 }) })`.
 */
export function near(expected: number, tolerance: Tolerance): Near {
  const { relative = 0, absolute = 0 } = tolerance
  return {
    $$typeof: Symbol.for('jest.asymmetricMatcher'),
    asymmetricMatch: (actual) =>
      typeof actual === 'number' && Number.isFinite(actual) && within(actual, expected, tolerance),
    toAsymmetricMatcher: () => `near(${expected}, relative ${relative}, absolute ${absolute})`,
  }
}
