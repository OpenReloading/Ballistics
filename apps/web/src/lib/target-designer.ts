/** The target face designer: the draft, its file data, the face it builds and the problems it reports. */
import type { FaceShape } from '@open-reloading/drawing/target'
import { faceColour, type TargetFace, type TargetFaceDesign } from '@open-reloading/schema'
import { untranslated } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import {
  type FieldSpec,
  type Fields,
  type FieldValue,
  fieldOf,
  siToStored,
  storedToSi,
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
import { roundedFieldText, type UnitSystem } from './units.ts'
import { buildFace } from './user-faces.ts'

/** Colours a ring zone or line can take, the face schema's. */
export const colours = faceColour.options

export type InnerRule = '' | 'touch' | 'cover'

/** A ring row; its numbers are in `Design.fields` under `ring.<id>.<value|diameter|height>`. */
export interface Row {
  id: string
  fill: string
  line: string
}

/** An event row; its numbers are `event.<id>.<distance|gauge>`. */
interface Event {
  id: string
  name: string
}

/** The draft: texts and colours as entered, numbers as fields (`black.*` and `inner.*` for the areas). */
export interface Design {
  name: string
  rows: Row[]
  events: Event[]
  rule: InnerRule
  decimal: boolean
  fields: Fields
}

let counter = 0
/** A row id, unique in this page: the actions that add a row carry one, so the reducer stays pure. */
export const rowId = () => `r${++counter}`

/** The spec of the field `key`: the quantity and the label as the grid names it. */
export function specOf(key: string): FieldSpec {
  const last = key.split('.').at(-1)
  const common = { key, positive: true }
  switch (last) {
    case 'value':
      return { ...common, label: msg('Ring value'), quantity: 'ratio', integer: true }
    case 'diameter':
      return { ...common, label: msg('Diameter'), quantity: 'length' }
    case 'height':
      return { ...common, label: msg('Height'), quantity: 'length' }
    case 'distance':
      return { ...common, label: msg('Distance'), quantity: 'range' }
    default:
      return { ...common, label: msg('Gauge'), quantity: 'length' }
  }
}

const blank: FieldValue = { text: '', si: undefined }
export const fieldAt = (d: Design, key: string): FieldValue => d.fields[key] ?? blank

const ringKeys = (id: string) => ['value', 'diameter', 'height'].map((k) => `ring.${id}.${k}`)
const eventKeys = (id: string) => ['distance', 'gauge'].map((k) => `event.${id}.${k}`)

const empty = (d: Design, keys: string[]) => keys.every((k) => fieldAt(d, k).text.trim() === '')

/** A ring row with no number, colour or line entered: it is not part of the face. */
const blankRing = (d: Design, r: Row) => empty(d, ringKeys(r.id)) && !r.fill && !r.line
const blankEvent = (d: Design, e: Event) => empty(d, eventKeys(e.id)) && e.name.trim() === ''

export const liveRows = (d: Design) => d.rows.filter((r) => !blankRing(d, r))
const liveEvents = (d: Design) => d.events.filter((e) => !blankEvent(d, e))

export function newDesign(): Design {
  const rows = [
    { id: rowId(), fill: '', line: '' },
    { id: rowId(), fill: '', line: '' },
  ]
  return {
    name: '',
    rows,
    events: [{ id: rowId(), name: '' }],
    rule: '',
    decimal: false,
    fields: {},
  }
}

/** The number of field `key` in the stored unit (mm, or the ring value), when it is a positive number (a whole one for a ring value). */
const stored = (d: Design, key: string) => {
  const si = fieldAt(d, key).si
  if (si === undefined || si <= 0) return
  // the schema's ring value is an integer: a decimal is left out, the field shows its error
  if (key.endsWith('.value')) return Number.isInteger(si) ? si : undefined
  // a decimal typed in mm or in comes back from SI without the noise of the division
  return Number(siToStored('length', si).toPrecision(12))
}

const optional = <T>(entries: Record<string, T | undefined>) =>
  Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined)) as Partial<
    Record<string, T>
  >

/** The file data of a design: the rows with something entered, each positive number in mm. */
export function fileData(d: Design): TargetFaceDesign {
  const n = (key: string) => stored(d, key)
  const inner = optional({
    diameter: n('inner.diameter'),
    height: n('inner.height'),
    rule: d.rule || undefined,
  })
  return {
    rings: liveRows(d).map((r) => ({
      ...optional({
        value: n(`ring.${r.id}.value`),
        diameter: n(`ring.${r.id}.diameter`),
        height: n(`ring.${r.id}.height`),
      }),
      ...(r.fill && { fill: r.fill as TargetFaceDesign['rings'][number]['fill'] }),
      ...(r.line && { line: r.line as TargetFaceDesign['rings'][number]['line'] }),
    })),
    ...(Object.keys(inner).length > 0 && { innerTen: inner }),
    ...optional({ blackDiameter: n('black.diameter'), blackHeight: n('black.height') }),
    ...(d.decimal && { decimal: true }),
    events: liveEvents(d).map((e) => ({
      name: e.name,
      ...optional({ distance: n(`event.${e.id}.distance`), gauge: n(`event.${e.id}.gauge`) }),
    })),
  } as TargetFaceDesign
}

/** The draft of file data `data` named `name`, its numbers shown in `system`. */
export function fromFile(data: TargetFaceDesign, name: string, system: UnitSystem): Design {
  const fields: Fields = {}
  const put = (key: string, mm: number | undefined) => {
    if (mm !== undefined)
      fields[key] = fieldOf(
        system,
        specOf(key),
        key.endsWith('.value') ? mm : storedToSi('length', mm),
      )
  }
  const rows = data.rings.map((r) => {
    const id = rowId()
    put(`ring.${id}.value`, r.value)
    put(`ring.${id}.diameter`, r.diameter)
    put(`ring.${id}.height`, r.height)
    return { id, fill: r.fill ?? '', line: r.line ?? '' }
  })
  const events = data.events.map((e) => {
    const id = rowId()
    put(`event.${id}.distance`, e.distance)
    put(`event.${id}.gauge`, e.gauge)
    return { id, name: e.name }
  })
  put('inner.diameter', data.innerTen?.diameter)
  put('inner.height', data.innerTen?.height)
  put('black.diameter', data.blackDiameter)
  put('black.height', data.blackHeight)
  return {
    name,
    rows,
    events,
    rule: data.innerTen?.rule ?? '',
    decimal: data.decimal ?? false,
    fields,
  }
}

/** A reason the draft is no face: the field it belongs to, else it is about the face as a whole. */
export interface Problem {
  key?: string | undefined
  message: string
}

const fieldKeyOf = (d: Design, path: PropertyKey[]): string | undefined => {
  const [head, index, field] = path
  const part = (list: { id: string }[], prefix: string) =>
    typeof index === 'number' && typeof field === 'string' && list[index]
      ? `${prefix}.${list[index].id}.${field}`
      : undefined
  if (head === 'rings') return part(liveRows(d), 'ring')
  if (head === 'events') return part(liveEvents(d), 'event')
  if (head === 'innerTen' && typeof index === 'string' && index !== 'rule') return `inner.${index}`
  if (head === 'blackDiameter') return 'black.diameter'
  if (head === 'blackHeight') return 'black.height'
}

const labels: Record<string, Message> = {
  rings: msg('Rings'),
  events: msg('Events of the target'),
  blackDiameter: msg('Black area diameter'),
  blackHeight: msg('Black area height'),
  innerTen: msg('Inner ten'),
}

/** The refusals of the face schema and of the face builder, by their text, as messages the catalogue holds. */
const faceMessages: Record<string, Message> = {
  'Required.': msg('Required.'),
  'must be one above the ring outside it': msg('must be one above the ring outside it'),
  'must be below the ring outside it': msg('must be below the ring outside it'),
  'must not exceed the innermost ring': msg('must not exceed the innermost ring'),
  'a square has no height': msg('a square has no height'),
  'height on all rings or on none': msg('height on all rings or on none'),
  'tenth-ring values need circular rings': msg('tenth-ring values need circular rings'),
  'cover needs a circular inner ten': msg('cover needs a circular inner ten'),
  'a height needs oval rings': msg('a height needs oval rings'),
  'stadium on all rings or on none': msg('stadium on all rings or on none'),
  'a stadium needs a height': msg('a stadium needs a height'),
  'a stadium is at least as high as it is wide': msg('a stadium is at least as high as it is wide'),
  'a stadium inner ten needs a height': msg('a stadium inner ten needs a height'),
  'must be unique within the face': msg('must be unique within the target'),
  'black zones must be adjacent rings': msg('black zones must be adjacent rings'),
  'must equal the diameter of the outermost black ring': msg(
    'must equal the diameter of the outermost black ring',
  ),
}

/** A refusal in the language of `t`: a text the table lacks (a zod message) stays as it is. */
function faceMessage(text: string, t: Translator['t']) {
  const known = faceMessages[text]
  if (known) return t(known)
  const needed = /^at least (\d+) needed\.$/.exec(text)
  return needed ? t('at least {n} needed.', { n: Number(needed[1]) }) : text
}

/**
 * The face the draft builds as the tools use it, or the problems with the draft in the language of
 * `t`: those of a field carry its key, the others name the part of the face.
 */
export function faceOf(
  d: Design,
  id: string,
  t: Translator['t'] = untranslated(),
): { face: TargetFace } | { problems: Problem[] } {
  const built = buildFace(fileData(d), id, d.name.trim() || 'Target design')
  if ('face' in built) return built
  return {
    problems: built.issues.map(({ path, message: given }) => {
      const key = fieldKeyOf(d, path)
      const part = typeof path[0] === 'string' ? labels[path[0]] : undefined
      const message = faceMessage(given, t)
      return key || !part
        ? { key, message }
        : { message: t('{part}: {message}', { part: t(part), message }) }
    }),
  }
}

/** The outline the live drawing shows: every ring with a diameter, the black area if given. */
export function shapeOf(d: Design): FaceShape | undefined {
  const rings = liveRows(d).flatMap((r, i) => {
    const diameter = stored(d, `ring.${r.id}.diameter`)
    if (diameter === undefined) return []
    const height = stored(d, `ring.${r.id}.height`)
    return [
      {
        value: stored(d, `ring.${r.id}.value`) ?? i + 1,
        diameter: { value: diameter },
        ...(height !== undefined && { height: { value: height } }),
        ...(r.fill && { fill: r.fill }),
        ...(r.line && { line: r.line }),
      },
    ]
  })
  if (rings.length === 0) return
  const inner = stored(d, 'inner.diameter')
  const innerHeight = stored(d, 'inner.height')
  const height = stored(d, 'black.height')
  return {
    rings,
    ...(inner !== undefined && {
      innerTen: {
        diameter: { value: inner },
        ...(innerHeight !== undefined && { height: { value: innerHeight } }),
      },
    }),
    blackDiameter: { value: stored(d, 'black.diameter') ?? 0 },
    ...(height !== undefined && { blackHeight: { value: height } }),
  }
}

export type Action =
  | { type: 'field'; key: string; value: FieldValue }
  | { type: 'name'; value: string }
  | { type: 'colour'; id: string; part: 'fill' | 'line'; value: string }
  | { type: 'rule'; value: InnerRule }
  | { type: 'decimal'; value: boolean }
  | { type: 'eventName'; id: string; value: string }
  | { type: 'addRing'; id: string }
  | { type: 'removeRing'; id: string }
  | { type: 'addEvent'; id: string }
  | { type: 'removeEvent'; id: string }
  | { type: 'start'; design: Design }
  | { type: 'new' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'units'; system: UnitSystem }

const without = (fields: Fields, keys: string[]) =>
  Object.fromEntries(Object.entries(fields).filter(([k]) => !keys.includes(k)))

/** The history after `a`: a run of edits to one field is one undo step. */
export function reduce(h: History<Design>, a: Action): History<Design> {
  const d = h.present
  switch (a.type) {
    case 'field':
      return editHistory(h, { ...d, fields: { ...d.fields, [a.key]: a.value } }, a.key)
    case 'name':
      return editHistory(h, { ...d, name: a.value }, 'name')
    case 'eventName':
      return editHistory(
        h,
        { ...d, events: d.events.map((e) => (e.id === a.id ? { ...e, name: a.value } : e)) },
        `event.${a.id}.name`,
      )
    case 'colour':
      return pushHistory(
        h,
        { ...d, rows: d.rows.map((r) => (r.id === a.id ? { ...r, [a.part]: a.value } : r)) },
        `ring.${a.id}.${a.part}`,
      )
    case 'rule':
      return pushHistory(h, { ...d, rule: a.value }, 'rule')
    case 'decimal':
      return pushHistory(h, { ...d, decimal: a.value }, 'decimal')
    case 'addRing': {
      const { id } = a
      // the next ring inward is one above the last one's value
      const last = d.rows.at(-1)
      const value = last && fieldAt(d, `ring.${last.id}.value`).si
      const next =
        value !== undefined && Number.isInteger(value)
          ? { [`ring.${id}.value`]: { text: String(value + 1), si: value + 1 } }
          : {}
      return pushHistory(h, {
        ...d,
        rows: [...d.rows, { id, fill: '', line: '' }],
        fields: { ...d.fields, ...next },
      })
    }
    case 'removeRing':
      return pushHistory(h, {
        ...d,
        rows: d.rows.filter((r) => r.id !== a.id),
        fields: without(d.fields, ringKeys(a.id)),
      })
    case 'addEvent':
      return pushHistory(h, { ...d, events: [...d.events, { id: a.id, name: '' }] })
    case 'removeEvent':
      return pushHistory(h, {
        ...d,
        events: d.events.filter((e) => e.id !== a.id),
        fields: without(d.fields, eventKeys(a.id)),
      })
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
