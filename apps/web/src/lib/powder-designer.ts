/** The powder designer: the draft, its file data, the powder it builds and the problems it reports. */
import {
  fromSi,
  type Powder,
  powder as powderSchema,
  type QuantityKind,
  toSi,
  type UserPowder,
  type UserPowderFit,
  type UserRecord,
} from '@open-reloading/schema'
import { untranslated } from '../i18n/number.ts'
import { english, type Message, msg, type Translator } from '../i18n/translate.ts'
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldOf,
  specText,
  switchFields,
} from './field-spec.ts'
import {
  editHistory,
  type History,
  historyOf,
  mapHistory,
  pushHistory,
  redo,
  undo,
} from './history.ts'
import type { Quantity, UnitSystem } from './units.ts'
import { roundedFieldText } from './units.ts'

type FittedKey = NonNullable<Powder['interior']>['fitted'][number]

/** How the values of the powder came about: the kind of the provenance the record is built with. */
export type ProvenanceKind = Powder['provenance']['kind']

/** The choices of the grain form, the propellant base and the provenance kind, from the schema. */
export const grainForms = [
  'ball',
  'extruded',
  'flake',
  'other',
] as const satisfies readonly NonNullable<Powder['grainForm']>[]
export const propellantBases = [
  'single',
  'double',
  'triple',
] as const satisfies readonly NonNullable<Powder['propellantBase']>[]
export const provenanceKinds = [
  'measured',
  'published',
  'derived',
  'fitted',
  'computed',
] as const satisfies readonly ProvenanceKind[]

/** The parameters the fit of the burn law moved, as the record names them. */
export const fittedKeys = ['vivacity', 'energy', 'form.a'] as const satisfies readonly FittedKey[]

/** The fixed name of the powder in the tools where a draft has none. */
export const fallbackName = 'Powder design'

/** The manufacturer id and the source title of the record a design builds: it has neither of its own. */
const userMaker = 'user-design'
const userSource = 'User design'

/** A numeric field of the draft: where it is in the record, its quantity in the form and its stored kind. */
export interface PowderSpec extends FieldSpec {
  /** The stored quantity of the schema. */
  kind: QuantityKind
  group: 'properties' | 'thermochemistry' | 'burn'
}

const spec = (
  key: string,
  label: string,
  quantity: Quantity,
  kind: QuantityKind,
  group: PowderSpec['group'],
  help: string,
): PowderSpec => ({ key, label, quantity, kind, group, help })

/** A field of the burn law; without a quantity it is a plain number. */
const burn = (
  key: string,
  label: string,
  help: string,
  quantity: Quantity = 'ratio',
  kind: QuantityKind = 'dimensionless',
): PowderSpec => spec(key, label, quantity, kind, 'burn', help)

/** The three numbers of a computed range of the thermochemistry, labelled value, min and max. */
const range = (
  name: string,
  labels: readonly [Message, Message, Message],
  quantity: Quantity,
  kind: QuantityKind,
  help: string,
): PowderSpec[] =>
  (['value', 'min', 'max'] as const).map((part, i) =>
    spec(
      `thermochemistry.${name}.${part}`,
      labels[i] ?? part,
      quantity,
      kind,
      'thermochemistry',
      help,
    ),
  )

/** The fields of a powder record with a number that the designer offers, in stored units. */
export const powderSpecs: readonly PowderSpec[] = [
  spec(
    'bulkDensity.value',
    msg('Bulk density'),
    'density',
    'density',
    'properties',
    msg('Mass per volume of uncompressed powder, voids between the grains included.'),
  ),
  spec(
    'thermochemistry.loadingDensity.value',
    msg('Loading density'),
    'density',
    'density',
    'thermochemistry',
    msg('The loading density of the constant-volume burning the values below are for.'),
  ),
  ...range(
    'flameTemperature',
    [msg('Flame temperature value'), msg('Flame temperature min'), msg('Flame temperature max')],
    'temperature',
    'absoluteTemperature',
    msg(
      'Flame temperature of the constant-volume burning, with its extremes over the composition ranges.',
    ),
  ),
  ...range(
    'impetus',
    [msg('Impetus value'), msg('Impetus min'), msg('Impetus max')],
    'specificEnergy',
    'specificEnergy',
    msg('Impetus of the burning, with its extremes.'),
  ),
  ...range(
    'gamma',
    [msg('Gamma value'), msg('Gamma min'), msg('Gamma max')],
    'ratio',
    'dimensionless',
    msg('Frozen ratio of specific heats at the flame temperature, with its extremes.'),
  ),
  ...range(
    'molarMass',
    [msg('Molar mass value'), msg('Molar mass min'), msg('Molar mass max')],
    'molarMass',
    'molarMass',
    msg('Mean molar mass of the combustion gas, with its extremes.'),
  ),
  ...range(
    'covolume',
    [msg('Covolume value'), msg('Covolume min'), msg('Covolume max')],
    'covolume',
    'specificVolume',
    msg('Covolume of the combustion gas, with its extremes.'),
  ),
  burn(
    'interior.vivacity.value',
    msg('Vivacity'),
    msg('Burn rate scale of the vivacity law at the reference pressure.'),
    'vivacity',
    'burnRate',
  ),
  burn(
    'interior.energy.value',
    msg('Specific energy'),
    msg('Specific energy of the powder at constant volume.'),
    'specificEnergy',
    'specificEnergy',
  ),
  burn('interior.gamma', msg('Gamma'), msg('Ratio of specific heats of the gas; above 1.')),
  burn(
    'interior.covolume.value',
    msg('Covolume'),
    msg('Covolume of the gas.'),
    'covolume',
    'specificVolume',
  ),
  burn(
    'interior.density.value',
    msg('Grain density'),
    msg('Solid density of the grains.'),
    'density',
    'density',
  ),
  burn(
    'interior.pressureExponent',
    msg('Pressure exponent'),
    msg('Exponent of the pressure in the burn law.'),
  ),
  burn(
    'interior.referencePressure.value',
    msg('Reference pressure'),
    msg('Pressure at which the vivacity holds.'),
    'pressure',
    'pressure',
  ),
  burn(
    'interior.ignitionPressure.value',
    msg('Ignition pressure'),
    msg('Pressure at which the grains start to burn.'),
    'pressure',
    'pressure',
  ),
  burn(
    'interior.startPressure.value',
    msg('Start pressure'),
    msg('Pressure at which the bullet starts to move. Empty: the default of the solver.'),
    'pressure',
    'pressure',
  ),
  burn(
    'interior.propellantTemperature.value',
    msg('Propellant temperature'),
    msg('Temperature of the propellant the parameters were fitted at.'),
    'temperature',
    'temperature',
  ),
  burn(
    'interior.burnForm.a.value',
    msg('Form a'),
    msg('Form parameter a of the two-stage burn form.'),
  ),
  burn('interior.burnForm.m', msg('Form m'), msg('Form parameter m of the two-stage burn form.')),
  burn(
    'interior.burnForm.q',
    msg('Form q'),
    msg('Form parameter q of the two-stage burn form; not negative.'),
  ),
  burn(
    'interior.burnForm.z1',
    msg('Form z1'),
    msg('Burnt fraction at which the first stage ends; above 0, at most 1.'),
  ),
]

const specByKey = new Map(powderSpecs.map((s) => [s.key, s]))

/** The spec of the field `key`: a listed number, or the mass percent of an ingredient (`comp.<id>.min|max`). */
export function specOf(key: string): PowderSpec {
  const own = specByKey.get(key)
  if (own) return own
  const label = key.endsWith('.max') ? msg('Mass percent max') : msg('Mass percent min')
  return spec(key, label, 'percent', 'massFraction', 'properties', '')
}

/** An ingredient row; its numbers are `comp.<id>.min` and `comp.<id>.max`. */
interface Ingredient {
  id: string
  name: string
  cas: string
}

/** The draft: texts and choices as entered, numbers as fields. */
export interface Design {
  name: string
  provenanceKind: ProvenanceKind | ''
  grainForm: NonNullable<Powder['grainForm']> | ''
  propellantBase: NonNullable<Powder['propellantBase']> | ''
  /** One alias per line. */
  aliases: string
  note: string
  fitted: FittedKey[]
  rows: Ingredient[]
  fields: Fields
  /** The burn-law fields of an opened record that the designer has no input for, kept as they were. */
  unoffered: Tree
  /** The temperature sensitivity of an opened record, which the designer has no input for, kept as it was. */
  temperatureSensitivity?: Tree | undefined
  /** The fit of an opened record saved from a fit, with the SI values of its fitted fields then. */
  fit?: { block: UserPowderFit; values: Record<string, number | undefined> } | undefined
}

/** The fields that hold the values a fit frees, by its parameter name. */
const fitFields = { burnRate: 'interior.vivacity.value', energy: 'interior.energy.value' } as const

/** The fit of the opened record while no value it fitted was edited; an edited one drops it. */
const keptFit = (d: Design) =>
  d.fit && Object.values(fitFields).every((k) => fieldAt(d, k).si === d.fit?.values[k])
    ? d.fit.block
    : undefined

let counter = 0
/** A row id, unique in this page: the actions that add a row carry one, so the reducer stays pure. */
export const rowId = () => `i${++counter}`

const blank: FieldValue = { text: '', si: undefined }
/** The value of the field `key`, empty where it was never typed. */
export const fieldAt = (d: Design, key: string): FieldValue => d.fields[key] ?? blank

/** The empty draft. */
export const newDesign = (): Design => ({
  name: '',
  provenanceKind: '',
  grainForm: '',
  propellantBase: '',
  aliases: '',
  note: '',
  fitted: [],
  rows: [{ id: rowId(), name: '', cas: '' }],
  fields: {},
  unoffered: {},
})

const rowKeys = (id: string) => [`comp.${id}.min`, `comp.${id}.max`]
const blankRow = (d: Design, r: Ingredient) =>
  r.name.trim() === '' &&
  r.cas.trim() === '' &&
  rowKeys(r.id).every((k) => fieldAt(d, k).text.trim() === '')
/** The ingredient rows with something entered: the others are not part of the record. */
const liveRows = (d: Design) => d.rows.filter((r) => !blankRow(d, r))

/** The number `si` in the stored unit of `s`, without the noise of the unit conversion. */
const storedOf = (s: PowderSpec, si: number) => Number(fromSi(s.kind, si).toPrecision(12))

type Tree = Record<string, unknown>

function setPath(tree: Tree, path: string[], value: unknown) {
  const [head, ...rest] = path
  if (head === undefined) return
  if (rest.length === 0) tree[head] = value
  else {
    const next = (tree[head] ?? {}) as Tree
    tree[head] = next
    setPath(next, rest, value)
  }
}

function getPath(tree: unknown, path: string[]): unknown {
  let at = tree
  for (const k of path) {
    if (typeof at !== 'object' || at === null) return undefined
    at = (at as Tree)[k]
  }
  return at
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * The burn law of the draft: the numbers entered with the fixed model and burn form names, and
 * the parameters the fit moved; none while nothing of it is entered.
 */
function interiorOf(entered: Tree | undefined, fitted: readonly FittedKey[]): Tree | undefined {
  if (entered === undefined && fitted.length === 0) return undefined
  const burnForm = entered?.burnForm as Tree | undefined
  return {
    ...entered,
    model: 'm3',
    ...(burnForm && { burnForm: { ...burnForm, kind: 'twoStage' } }),
    ...(fitted.length > 0 && { fitted: [...fitted] }),
  }
}

/** The record data of a design: what is entered, each number in its stored unit. */
export function fileData(d: Design): UserPowder {
  const draft: Tree = {}
  for (const s of powderSpecs) {
    const si = fieldAt(d, s.key).si
    if (si !== undefined) setPath(draft, s.key.split('.'), storedOf(s, si))
  }
  if (d.grainForm) draft.grainForm = d.grainForm
  if (d.propellantBase) draft.propellantBase = d.propellantBase
  const aliases = lines(d.aliases)
  if (aliases.length > 0) draft.aliases = aliases
  if (d.note.trim()) draft.note = d.note.trim()
  const rows = liveRows(d).map((r) => {
    const [min, max] = rowKeys(r.id).map((k) => {
      const si = fieldAt(d, k).si
      return si === undefined ? undefined : storedOf(specOf(k), si)
    })
    return {
      ...(r.name.trim() && { name: r.name.trim() }),
      ...(r.cas.trim() && { cas: r.cas.trim() }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
    }
  })
  if (rows.length > 0) draft.composition = rows
  const interior = interiorOf(draft.interior as Tree | undefined, d.fitted)
  if (interior) draft.interior = { ...interior, ...d.unoffered }
  if (d.temperatureSensitivity) draft.temperatureSensitivity = d.temperatureSensitivity
  const fit = keptFit(d)
  return {
    origin: 'user',
    ...(d.provenanceKind && { provenanceKind: d.provenanceKind }),
    ...(Object.keys(draft).length > 0 && { draft: draft as NonNullable<UserPowder['draft']> }),
    ...(fit && { fit }),
  }
}

const unofferedKeys = ['resistance', 'trainingRows', 'trainingCartridges'] as const

const unofferedOf = (interior: Tree | undefined): Tree =>
  Object.fromEntries(
    unofferedKeys.flatMap((k) => (interior?.[k] === undefined ? [] : [[k, interior[k]]])),
  )

/** The draft of record data `data` named `name`, its numbers shown in `system`. */
export function fromFile(data: UserPowder, name: string, system: UnitSystem): Design {
  const fields: Fields = {}
  const put = (s: PowderSpec, stored: unknown) => {
    if (typeof stored === 'number') fields[s.key] = fieldOf(system, s, toSi(s.kind, stored))
  }
  for (const s of powderSpecs) put(s, getPath(data.draft, s.key.split('.')))
  const draft = data.draft
  const rows = (draft?.composition ?? []).map((c) => {
    const id = rowId()
    put(specOf(`comp.${id}.min`), c.min)
    put(specOf(`comp.${id}.max`), c.max)
    return { id, name: c.name ?? '', cas: c.cas ?? '' }
  })
  return {
    name,
    provenanceKind: data.provenanceKind ?? '',
    grainForm: draft?.grainForm ?? '',
    propellantBase: draft?.propellantBase ?? '',
    aliases: (draft?.aliases ?? []).join('\n'),
    note: draft?.note ?? '',
    fitted: [...(draft?.interior?.fitted ?? [])],
    rows: rows.length > 0 ? rows : [{ id: rowId(), name: '', cas: '' }],
    fields,
    unoffered: unofferedOf(draft?.interior as Tree | undefined),
    ...(draft?.temperatureSensitivity && {
      temperatureSensitivity: draft.temperatureSensitivity as Tree,
    }),
    ...(data.fit && {
      fit: {
        block: data.fit,
        values: Object.fromEntries(Object.values(fitFields).map((k) => [k, fields[k]?.si])),
      },
    }),
  }
}

/** A reason the draft is no powder: the field it belongs to, else it is about the record as a whole. */
export interface Problem {
  key?: string | undefined
  message: string
}

/** The name of the place a problem is at, for the list of problems. */
export function problemLabel(key: string, t: Translator['t'] = untranslated()) {
  if (key === 'provenanceKind') return t('Provenance')
  if (key === 'fitted') return t('Burn law')
  return key.startsWith('comp.') ? t('Composition') : specText(t, specOf(key).label)
}

/** One issue of the powder schema. */
interface Issue {
  path: PropertyKey[]
  message: string
}

/** The record data builds this powder, or the issues of the powder schema by path. */
export function powderOf(
  data: UserPowder,
  name: string,
  id: string,
): { powder: Powder } | { issues: Issue[] } {
  const parsed = powderSchema.safeParse({
    ...data.draft,
    id,
    manufacturer: userMaker,
    name: name.trim() || fallbackName,
    provenance: { kind: data.provenanceKind, sources: [{ title: userSource }] },
  })
  return parsed.success ? { powder: parsed.data } : { issues: parsed.error.issues }
}

const sectionLabels: Record<string, Message> = {
  composition: msg('Composition'),
  thermochemistry: msg('Thermochemistry'),
  interior: msg('Burn law'),
  aliases: msg('Aliases'),
  bulkDensity: msg('Bulk density'),
}

/**
 * The field a schema issue belongs to. A value the record needs and the draft lacks is reported
 * at each empty field below that place ("Required."); `fitted` and the provenance kind have their
 * own keys.
 */
/** The message of a missing value in the powder schema. */
const required = /received undefined/

function problemsOf(d: Design, issues: Issue[], t: Translator['t']): Problem[] {
  const live = liveRows(d)
  return issues.flatMap((issue): Problem[] => {
    const key = keyOf(live, issue.path)
    if (key === 'provenanceKind' && issue.path[0] === 'interior')
      return [{ key, message: t('The burn law needs the kind "Fitted to data".') }]
    if (key)
      return [{ key, message: required.test(issue.message) ? t('Required.') : issue.message }]
    const prefix = `${issue.path.join('.')}.`
    const empty = powderSpecs.filter(
      (s) => s.key.startsWith(prefix) && fieldAt(d, s.key).text.trim() === '',
    )
    if (required.test(issue.message) && empty.length > 0)
      return empty.map((s) => ({ key: s.key, message: t('Required.') }))
    const part = typeof issue.path[0] === 'string' ? sectionLabels[issue.path[0]] : undefined
    return [
      {
        message: part
          ? t('{part}: {message}', { part: t(part), message: issue.message })
          : issue.message,
      },
    ]
  })
}

/** The key of the field an issue at `path` belongs to; undefined for an issue about the record or a section. */
function keyOf(live: readonly Ingredient[], path: PropertyKey[]): string | undefined {
  const [head, index, part] = path
  // a rule across the two percentages of an ingredient is shown at its minimum
  if (head === 'composition') {
    const row = typeof index === 'number' ? live[index] : undefined
    return row && `comp.${row.id}.${part === 'max' ? 'max' : 'min'}`
  }
  // the burn law needs a fitted source, which the provenance kind gives
  if (head === 'provenance' || (head === 'interior' && path.length === 1)) return 'provenanceKind'
  if (head === 'interior' && index === 'fitted') return 'fitted'
  const key = path.join('.')
  // a range that needs min <= value <= max is reported at its value
  return specByKey.has(key) ? key : specByKey.has(`${key}.value`) ? `${key}.value` : undefined
}

/** The note a result carries, on screen and in print, when the powder values are a user design's. */
export const powderDesignNote = (name: string, t: Translator['t'] = english.t) =>
  t('Powder values from the user design {name}, not a catalogue record.', { name })

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
    return 'powder' in built
      ? [{ id: r.id, name: r.name, powder: built.powder, fit: r.data.fit }]
      : []
  })

/**
 * The newest design (latest fit date, then id) whose `fit.previous` chain reaches the powder `id`,
 * or undefined when no refit of it is stored. A refit names the record it refits, so the chain is
 * walked from `id` forward; deleting a powder relinks the records that name it (`deleteRecords`).
 */
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

/** The powder the draft builds as the tools use it, or the problems with the draft in the language of `t`. */
export function checkDesign(
  d: Design,
  id: string,
  t: Translator['t'] = untranslated(),
): { powder: Powder } | { problems: Problem[] } {
  const built = powderOf(fileData(d), d.name, id)
  // a typed text that reads as no number is left out of the record, so the record is not done
  const unread = Object.entries(d.fields)
    .filter(([, v]) => v.text.trim() !== '' && v.si === undefined)
    .map(([key]) => ({ key, message: t('Not a number.') }))
  if ('powder' in built) return unread.length > 0 ? { problems: unread } : built
  return { problems: [...unread, ...problemsOf(d, built.issues, t)] }
}

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'name'; value: string }
  | { type: 'text'; key: 'aliases' | 'note'; value: string }
  | { type: 'provenanceKind'; value: ProvenanceKind | '' }
  | { type: 'grainForm'; value: Design['grainForm'] }
  | { type: 'propellantBase'; value: Design['propellantBase'] }
  | { type: 'fitted'; key: FittedKey; value: boolean }
  | { type: 'ingredient'; id: string; part: 'name' | 'cas'; value: string }
  | { type: 'addRow'; id: string }
  | { type: 'removeRow'; id: string }
  | { type: 'start'; design: Design }
  | { type: 'new' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

/** The history after `a`: a run of edits to one field is one undo step. */
export function reduce(h: History<Design>, a: Action): History<Design> {
  const d = h.present
  switch (a.type) {
    case 'field':
      return editHistory(h, { ...d, fields: { ...d.fields, [a.key]: a.value } }, a.key)
    case 'name':
      return editHistory(h, { ...d, name: a.value }, 'name')
    case 'text':
      return editHistory(h, { ...d, [a.key]: a.value }, a.key)
    case 'provenanceKind':
      return pushHistory(h, { ...d, provenanceKind: a.value }, 'provenanceKind')
    case 'grainForm':
      return pushHistory(h, { ...d, grainForm: a.value }, 'grainForm')
    case 'propellantBase':
      return pushHistory(h, { ...d, propellantBase: a.value }, 'propellantBase')
    case 'fitted':
      return pushHistory(
        h,
        {
          ...d,
          fitted: a.value
            ? fittedKeys.filter((k) => k === a.key || d.fitted.includes(k))
            : d.fitted.filter((k) => k !== a.key),
        },
        `fitted.${a.key}`,
      )
    case 'ingredient':
      return editHistory(
        h,
        { ...d, rows: d.rows.map((r) => (r.id === a.id ? { ...r, [a.part]: a.value } : r)) },
        `comp.${a.id}.${a.part}`,
      )
    case 'addRow':
      return pushHistory(h, { ...d, rows: [...d.rows, { id: a.id, name: '', cas: '' }] })
    case 'removeRow': {
      const gone = rowKeys(a.id)
      return pushHistory(h, {
        ...d,
        rows: d.rows.filter((r) => r.id !== a.id),
        fields: Object.fromEntries(Object.entries(d.fields).filter(([k]) => !gone.includes(k))),
      })
    }
    case 'start':
      return historyOf(a.design)
    case 'new':
      return historyOf(newDesign())
    case 'undo':
      return undo(h)
    case 'redo':
      return redo(h)
    case 'units':
      return mapHistory(h, (x) => ({
        ...x,
        fields: switchFields(
          x.fields,
          Object.keys(x.fields).map(specOf),
          a.system,
          roundedFieldText,
        ),
      }))
  }
}
