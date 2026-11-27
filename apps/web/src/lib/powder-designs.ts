/** The powder designs the tools offer as the user's own: the powder a stored design builds, and its refits. */

import type { I18n } from '@lingui/core'
import {
  type Powder,
  powder as powderSchema,
  type UserPowder,
  type UserPowderFit,
  type UserRecord,
} from '@rangefoundry/schema'
import { linguiOf, loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/powder-designs.json' with { type: 'json' }

loadEnglish(englishMessages)

/** The fixed name of the powder in the tools where a draft has none. */
export const fallbackName = 'Powder design'

/** The manufacturer id and the source title of the record a design builds: it has neither of its own. */
const userMaker = 'user-design'
const userSource = 'User design'

/** One issue of the powder schema, with the bounds zod reports for a number out of range. */
export interface Issue {
  path: PropertyKey[]
  message: string
  code?: string
  expected?: string
  origin?: string
  minimum?: number | bigint
  maximum?: number | bigint
  inclusive?: boolean
}

/** The empty Min and Max of a thermochemistry range with a value: the same as the value. */
function withRanges(draft: UserPowder['draft']): UserPowder['draft'] {
  const thermo = draft?.thermochemistry as Record<string, unknown> | undefined
  if (!thermo) return draft
  const filled = Object.fromEntries(
    Object.entries(thermo).map(([k, v]) => {
      const r = v as { value?: unknown; min?: unknown; max?: unknown }
      if (k === 'loadingDensity' || typeof r?.value !== 'number') return [k, v]
      return [k, { ...r, min: r.min ?? r.value, max: r.max ?? r.value }]
    }),
  )
  return {
    ...draft,
    thermochemistry: filled as NonNullable<UserPowder['draft']>['thermochemistry'],
  }
}

/** An empty Min or Max of a thermochemistry range counts as its value. */
export function powderOf(
  data: UserPowder,
  name: string,
  id: string,
): { powder: Powder } | { issues: Issue[] } {
  const parsed = powderSchema.safeParse({
    ...withRanges(data.draft),
    id,
    manufacturer: userMaker,
    name: name.trim() || fallbackName,
    provenance: { kind: data.provenanceKind, sources: [{ title: userSource }] },
  })
  return parsed.success
    ? { powder: parsed.data }
    : { issues: parsed.error.issues as unknown as Issue[] }
}

/** The note a result carries, on screen and in print, when the powder values are a user design's. */
export const powderDesignNote = (name: string, i18n: I18n = linguiOf('en')) =>
  i18n._({
    id: 'powderDesigns.valuesFromUserDesign',
    message: 'Powder values from the user design {name}, not a catalogue record.',
    values: { name },
  })

/** A powder design of this browser that builds a valid powder: the tools offer it as the user's own. */
export interface PowderDesign {
  id: string
  name: string
  powder: Powder
  /** What a powder saved from the tuning screen was fitted to. */
  fit?: UserPowderFit | undefined
}

/** The valid powder designs among `records`, in the order given. */
export const powderDesigns = (records: readonly UserRecord[]): PowderDesign[] =>
  records.flatMap((r) => {
    if (r.kind !== 'powder') return []
    const built = powderOf(r.data, r.name, r.id)
    // the designer's own check beyond the schema: a vivacity above 0
    return 'powder' in built && (built.powder.interior?.vivacity.value ?? 1) > 0
      ? [{ id: r.id, name: r.name, powder: built.powder, fit: r.data.fit }]
      : []
  })

/** A refit names the record it refits, so the chain walks forward from `id`; `deleteRecords` relinks; undefined when no refit is stored. */
export function newerFit(designs: readonly PowderDesign[], id: string): PowderDesign | undefined {
  let newest: PowderDesign | undefined
  const seen = new Set<string>()
  const next = [id]
  for (let at = next.pop(); at !== undefined; at = next.pop()) {
    if (seen.has(at)) continue
    seen.add(at)
    for (const d of designs) {
      if (d.fit?.previous !== `user:${at}`) continue
      next.push(d.id)
      const date = newest?.fit?.date ?? ''
      if (!newest || d.fit.date > date || (d.fit.date === date && d.id > newest.id)) newest = d
    }
  }
  return newest
}
