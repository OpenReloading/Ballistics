import { recordIdRegex } from '@open-reloading/schema'
import type { FieldSpec, Fields } from './field-spec.ts'
import { exactFieldText, type PresetId, type UnitSystem } from './units.ts'

/** Query string of a calculator's inputs: unit preset, `extra` choices and every field's SI value. */
export function inputsQuery(
  preset: PresetId,
  fields: Fields,
  extra: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams({ units: preset })
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value)
  for (const [key, f] of Object.entries(fields))
    if (f.si !== undefined) query.set(key, String(f.si))
  return query.toString()
}

/** Every field of `specs` from a query string; a missing key or an invalid number leaves it empty. */
export function queryFields(
  query: URLSearchParams,
  specs: readonly FieldSpec[],
  system: UnitSystem,
  /** The field texts: `roundedFieldText` in the calculators. */
  text: typeof exactFieldText = exactFieldText,
): Fields {
  return Object.fromEntries(
    specs.map((s) => {
      const raw = query.get(s.key)?.trim()
      const si = Number(raw)
      return [
        s.key,
        raw && Number.isFinite(si)
          ? { text: text(s.quantity, system, si), si }
          : { text: '', si: undefined },
      ]
    }),
  )
}

/**
 * A workbench link with a result tab's inputs: `tab` names the tab, its keys (but `units`) follow
 * under `tab.`, since the forms share keys such as `twist`.
 */
export function withTab(query: string, tab: string, inputs: string): string {
  const out = new URLSearchParams(query)
  out.set('tab', tab)
  for (const [key, value] of new URLSearchParams(inputs))
    if (key !== 'units') out.set(`tab.${key}`, value)
  return out.toString()
}

/** The inputs `withTab` wrote for `tab`, with the link's `units`; undefined for another tab or no units. */
export function tabQuery(search: string, tab: string): URLSearchParams | undefined {
  const query = new URLSearchParams(search)
  const units = query.get('units')
  if (query.get('tab') !== tab || !units) return undefined
  const out = new URLSearchParams({ units })
  for (const [key, value] of query) if (key.startsWith('tab.')) out.set(key.slice(4), value)
  return out
}

/** A record id a link may name: the schema's form, at most 64 characters (a load file's limit). */
export const linkedId = (raw: string | null) =>
  raw && raw.length <= 64 && recordIdRegex.test(raw) ? raw : undefined

/** The `cartridge`, `bullet` and `powder` values of a link that `linkedId` drops, as `<kind> <value>`. */
export const droppedIds = (query: URLSearchParams) =>
  (['cartridge', 'bullet', 'powder'] as const).flatMap((k) => {
    const raw = query.get(k)
    return raw && !linkedId(raw) ? [`${k} ${raw}`] : []
  })

/**
 * What a workbench link opens: `values`, a copied load (`units` and field values; its `bullet` and
 * `powder` records come without their fills), `records`, a new load from a cartridge, bullet or
 * powder record page (`cartridge`, `bullet`, `powder` without `units`, filled from the records), or
 * nothing.
 */
export function linkedLoad(query: URLSearchParams):
  | { kind: 'values' }
  | {
      kind: 'records'
      cartridge?: string | undefined
      bullet?: string | undefined
      powder?: string | undefined
    }
  | undefined {
  if (query.has('units')) return { kind: 'values' }
  const cartridge = linkedId(query.get('cartridge'))
  const bullet = linkedId(query.get('bullet'))
  const powder = linkedId(query.get('powder'))
  if (!cartridge && !bullet && !powder) return undefined
  return {
    kind: 'records',
    ...(cartridge && { cartridge }),
    ...(bullet && { bullet }),
    ...(powder && { powder }),
  }
}

/** The link of a record page's "Use in workbench": a new load with that cartridge, bullet or powder. */
export const workbenchHref = (kind: 'cartridge' | 'bullet' | 'powder', id: string) =>
  `/workbench?${new URLSearchParams({ [kind]: id })}`

/**
 * What a run reads from the bullet and powder records, SI: the names, the bullet length, the bulk
 * density and the powder record's bore resistance under the keys of the fields that replace it. A
 * workbench link carries it under `record.`, so the load runs the same where a record is missing.
 */
export type RecordValues = {
  bullet?: { name?: string | undefined; length?: number | undefined } | undefined
  powder?:
    | {
        name?: string | undefined
        bulkDensity?: number | undefined
        boreFriction?: number | undefined
        engravingPressure?: number | undefined
        engravingLength?: number | undefined
      }
    | undefined
}

const recordKeys = {
  bullet: { name: 'record.bullet', length: 'record.bulletLength' },
  powder: {
    name: 'record.powder',
    bulkDensity: 'record.bulkDensity',
    boreFriction: 'record.boreFriction',
    engravingPressure: 'record.engravingPressure',
    engravingLength: 'record.engravingLength',
  },
} as const

/** `query` with `values` under `record.`; an undefined value writes nothing. */
export function withRecordValues(query: string, values: RecordValues): string {
  const out = new URLSearchParams(query)
  for (const kind of ['bullet', 'powder'] as const)
    for (const [key, name] of Object.entries(recordKeys[kind])) {
      const value = (values[kind] as Record<string, string | number | undefined> | undefined)?.[key]
      if (value !== undefined) out.set(name, String(value))
    }
  return out.toString()
}

/** A linked record name: at most 200 characters, as a record's manufacturer and name. */
const linkedName = (raw: string | null) => raw?.trim().slice(0, 200) || undefined
const linkedNumber = (raw: string | null) => {
  const x = Number(raw ?? Number.NaN)
  return Number.isFinite(x) && x > 0 ? x : undefined
}

/** The `record.` values of a link: names, positive numbers, and the engraving only with both its terms. */
export function recordValues(query: URLSearchParams): RecordValues {
  const k = recordKeys
  const bullet = {
    name: linkedName(query.get(k.bullet.name)),
    length: linkedNumber(query.get(k.bullet.length)),
  }
  const [pressure, length] = [
    linkedNumber(query.get(k.powder.engravingPressure)),
    linkedNumber(query.get(k.powder.engravingLength)),
  ]
  const powder = {
    name: linkedName(query.get(k.powder.name)),
    bulkDensity: linkedNumber(query.get(k.powder.bulkDensity)),
    boreFriction: linkedNumber(query.get(k.powder.boreFriction)),
    ...(pressure !== undefined && length !== undefined
      ? { engravingPressure: pressure, engravingLength: length }
      : {}),
  }
  const some = (o: object) => Object.values(o).some((v) => v !== undefined)
  return { ...(some(bullet) && { bullet }), ...(some(powder) && { powder }) }
}

/**
 * The parameters of a workbench link: the fragment's when it holds a copied load (`units`), else the
 * query's (the record pages' "Use in workbench", `preset`, `tab`).
 */
export function linkParams(location: { search: string; hash: string }): URLSearchParams {
  const fragment = new URLSearchParams(location.hash.slice(1))
  return fragment.has('units') ? fragment : new URLSearchParams(location.search)
}
