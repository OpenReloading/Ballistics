import { z } from 'zod'

/** The pattern of {@link recordId}. */
export const recordIdRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Lowercase kebab-case id, also the record's file name without `.json`. */
export const recordId = z.string().regex(recordIdRegex)

/** The pattern of {@link userId}: a lowercase UUID of version 1 to 8. */
export const userIdRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Id of a user record: a lowercase UUID, as `crypto.randomUUID()` returns it. */
export const userId = z.string().regex(userIdRegex).describe('Id of a user record: a UUID.')

/** Scope of a {@link Ref}: the git catalogue or the user's own records. */
export type RefScope = 'catalogue' | 'user'

/** A reference `<scope>:<id>`: `catalogue:` with a {@link recordId}, `user:` with a {@link userId}. */
export type Ref = `${RefScope}:${string}`

const refPattern = new RegExp(
  `^(?:catalogue:${recordIdRegex.source.slice(1, -1)}|user:${userIdRegex.source.slice(1, -1)})$`,
)

/**
 * Schema of a reference to a record of `kind` (the entity named in the description; the text
 * carries no kind): `"catalogue:<record id>"` or `"user:<UUID>"`.
 */
export const ref = (kind: string) =>
  z
    .string()
    .regex(refPattern)
    .describe(`Reference to a ${kind}: \`catalogue:<record id>\` or \`user:<UUID>\`.`)

/** The scope and id of a reference text, or undefined when `text` is no reference. */
export function parseRef(text: string): { scope: RefScope; id: string } | undefined {
  if (!refPattern.test(text)) return undefined
  const i = text.indexOf(':')
  return { scope: text.slice(0, i) as RefScope, id: text.slice(i + 1) }
}

/** A reference to a catalogue record only: `"catalogue:<record id>"`. */
export const catalogueRef = (kind: string) =>
  ref(kind)
    .regex(/^catalogue:/, `Not a catalogue ${kind}`)
    .describe(`Reference \`catalogue:<record id>\` to a catalogue ${kind}.`)
