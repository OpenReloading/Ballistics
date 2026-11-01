import { type Case, cartridgeCase, parseRef, type UserRecord } from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { FieldSpec } from './field-spec.ts'
import { measuredCapacityRef } from './load-record.ts'

/** The measured fields of a group of cases, in the form's units and in the order of the editor. */
export const caseGroupFields = [
  { key: 'mass', label: msg('Case mass'), quantity: 'mass', min: 0, positive: true },
  { key: 'trimLength', label: msg('Trim length'), quantity: 'length', min: 0, positive: true },
  { key: 'neckWall', label: msg('Neck wall'), quantity: 'length', min: 0, positive: true },
  {
    key: 'numberOfFirings',
    label: msg('Times fired'),
    help: msg('Firings of these cases so far.'),
    quantity: 'ratio',
    min: 0,
    integer: true,
  },
  {
    key: 'casesMeasured',
    label: msg('Cases measured'),
    help: msg('The number of cases the capacity and the other measured values come from.'),
    quantity: 'ratio',
    min: 1,
    positive: true,
    integer: true,
  },
  {
    key: 'spread',
    label: msg('Capacity spread'),
    help: msg('Standard deviation of the water capacity over the cases measured.'),
    quantity: 'mass',
    min: 0,
  },
] as const satisfies readonly FieldSpec[]

/** The water capacity to the mouth, the one measured value that is a record of its own. */
export const caseGroupCapacitySpec = {
  key: 'capacity',
  label: msg('Water capacity to the mouth'),
  help: msg(
    'Measured on the cases of this group, for example fired and sized. Mean of the cases measured. The workbench takes it as the measured case capacity.',
  ),
  quantity: 'capacity',
  min: 0,
  positive: true,
} as const satisfies FieldSpec

/** A new group of cases: no cartridge yet, brass. */
export const blankCaseGroup = (): Case => ({
  origin: 'user',
  name: '',
  cartridge: '',
  material: 'brass',
})

const labels: Record<string, Message> = Object.fromEntries(
  [...caseGroupFields, caseGroupCapacitySpec].map((s) => [s.key, s.label]),
)

/**
 * Why Save refuses a group of cases, as a sentence with the field label; undefined when the record
 * is valid. `name` is the record name, which must not be empty.
 */
export function caseGroupProblem(name: string, c: Case, t: Translator['t']): string | undefined {
  if (!name) return t('Enter a name.')
  if (!c.cartridge) return t('Choose the cartridge.')
  const [issue] = cartridgeCase.safeParse(c).error?.issues ?? []
  if (!issue) return
  // a stored quantity is `{ value }`: the field is the key above it
  const field = String(issue.path.findLast((p) => typeof p === 'string' && p !== 'value'))
  const label = labels[field]
  const what = label ? t(label) : field
  return issue.code === 'invalid_type'
    ? t('{what}: enter a number.', { what })
    : t('{what}: not valid.', { what })
}

/** The measured capacity (g) a group of cases names: its `capacity` record among `records`, else undefined. */
export function groupCapacity(c: Case, records: readonly UserRecord[]): number | undefined {
  const id = c.capacity && parseRef(c.capacity)?.id
  const r = records.find((x) => x.id === id)
  return r?.kind === 'caseCapacity' ? r.data.waterCapacity.value : undefined
}

/**
 * The group with its `capacity` naming the record of its measured capacity `m3` (water, SI): the
 * same record as the workbench's measured capacity of that cartridge and value, so a capacity is
 * stored once. Without `m3` the group keeps the reference it has, for a record this browser does
 * not hold; without a cartridge it names none.
 */
export function withCapacity(c: Case, m3: number | undefined): Case {
  const { capacity: held, ...rest } = c
  if (!c.cartridge) return rest
  if (m3 === undefined) return held === undefined ? rest : c
  return { ...rest, capacity: measuredCapacityRef(c.cartridge, m3) }
}

/** A group of the user's cases as the workbench's case choice lists it. */
export interface OwnCase {
  id: string
  name: string
  /** The cartridge reference. */
  cartridge: string
  /** The reference of the measured capacity record the group names. */
  capacity?: string | undefined
  /** That capacity, g, when its record is in the browser. */
  grams?: number | undefined
  /** The measured trim length, mm. */
  trimLength?: number | undefined
}

/** The groups of cases among `records`, with their measured capacity. */
export const ownCases = (records: readonly UserRecord[]): OwnCase[] =>
  records.flatMap((r) =>
    r.kind === 'case'
      ? [
          {
            id: r.id,
            name: r.name,
            cartridge: r.data.cartridge,
            capacity: r.data.capacity,
            grams: groupCapacity(r.data, records),
            trimLength: r.data.trimLength?.value,
          },
        ]
      : [],
  )
