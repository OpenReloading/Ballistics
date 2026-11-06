import { expect, it } from 'vitest'
import { z } from 'zod'
import type { Exact } from '../src/exact.ts'

// `tsc -p test` (the package's typecheck) fails when a `@ts-expect-error` below has no error to expect

const pair = z.object({ a: z.string(), b: z.number() })
const exact: z.ZodObject<{ a: z.ZodString; b: z.ZodNumber }> = pair satisfies Exact<
  typeof exact,
  typeof pair
>
const missingKey: z.ZodObject<{ a: z.ZodString }> =
  // @ts-expect-error -- the annotation lacks the key `b` of the parser
  pair satisfies Exact<typeof missingKey, typeof pair>
// @ts-expect-error -- a key `c` the parser lacks fails the annotation itself
const extraKey: z.ZodObject<{ a: z.ZodString; b: z.ZodNumber; c: z.ZodString }> = pair
const looser: z.ZodObject<{ a: z.ZodType; b: z.ZodNumber }> =
  // @ts-expect-error -- the annotation types `a` looser than the parser
  pair satisfies Exact<typeof looser, typeof pair>
// @ts-expect-error -- an annotation that makes the required `a` optional fails the annotation itself
const optional: z.ZodObject<{ a: z.ZodOptional<z.ZodString>; b: z.ZodNumber }> = pair
const maybe = z.object({ a: z.string().optional(), b: z.number() })
// @ts-expect-error -- an annotation that requires the optional `a` fails the annotation itself
const required: z.ZodObject<{ a: z.ZodString; b: z.ZodNumber }> = maybe

const nested = z.object({ cup: z.object({ m: z.string(), t: z.number() }) })
const nestedMissing: z.ZodObject<{ cup: z.ZodObject<{ m: z.ZodString }> }> =
  // @ts-expect-error -- the annotation lacks the nested key `t`
  nested satisfies Exact<typeof nestedMissing, typeof nested>

const sizes = z.enum(['a', 'b', 'c'])
const missingMember: z.ZodEnum<z.core.util.ToEnum<'a' | 'b'>> =
  // @ts-expect-error -- the annotation lacks the member `c`
  sizes satisfies Exact<typeof missingMember, typeof sizes>
// @ts-expect-error -- a member `d` the parser lacks fails the annotation itself
const extraMember: z.ZodEnum<z.core.util.ToEnum<'a' | 'b' | 'c' | 'd'>> = sizes

it('passes an exact annotation and leaves the parser as it is', () => {
  expect(exact).toBe(pair)
  expect(exact.parse({ a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 })
  const failing = [missingKey, extraKey, looser, optional, required, nestedMissing]
  expect([...failing, missingMember, extraMember]).toHaveLength(8)
})
