import { expect } from 'vitest'
import type { z } from 'zod'

/** The issue paths (dot-joined, `''` for the root) of a value the schema refuses; none when it accepts. */
export const issuePaths = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

/** Expects `schema` to refuse `value` with an issue at `path` or inside it, so no other field's error passes the test. */
export const expectIssueAt = (schema: z.ZodType, value: unknown, path: string) => {
  const paths = issuePaths(schema, value)
  const hit = paths.some((p) => p === path || p.startsWith(`${path}.`))
  expect(hit, `issues at: ${paths.join(', ') || 'none'}`).toBe(true)
}
