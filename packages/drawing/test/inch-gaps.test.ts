import { expect, it } from 'vitest'
import { inchGapFailures } from './inch-figures.ts'

// apart from inch.test.ts so the two files run on separate workers
it.each(['screen', 'page print'] as const)(
  'keeps every text a gap from the others and every angle text off its own arc (%s, in)',
  (medium) => expect(inchGapFailures(medium)).toEqual([]),
  120_000,
)
