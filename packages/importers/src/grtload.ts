// The load files of Gordon's Reloading Tool (`.grtload`, XML) as user records. The mapping and
// its reasons: `apps/docs/docs/data/grt-load-files.md`. It was written from saved files.

import type { UserRecord } from '@open-reloading/schema'
import { idOfKey } from './record-ids.ts'
import { keyText } from './records.ts'
import { parseXml, type XmlElement } from './xml.ts'

/** The root element of the file, which tells it apart from other XML. */
const grtLoadRoot = 'GordonsReloadingTool'

type Kind = 'length' | 'area' | 'mass' | 'pressure' | 'density' | 'temperature' | 'one'

/** The factor from each unit a file may declare to the stored unit of the quantity. */
const factors: Record<Kind, Record<string, number>> = {
  length: { mm: 1, cm: 10, m: 1000 },
  area: { mm2: 1, cm2: 100 },
  mass: { g: 1, kg: 1000, mg: 0.001 },
  pressure: { bar: 1, Pa: 1e-5, kPa: 0.01, MPa: 10 },
  density: { 'kg/m3': 0.001, 'g/cm3': 1 },
  temperature: { Cel: 1 },
  one: { '': 1 },
}

/** The fields read, by section and name: text, or a number of a kind. Every other field is listed as not read. */
const fields = {
  'caliber.CaliberName': 'text',
  'caliber.oal': 'length',
  'caliber.caselen': 'length',
  'caliber.Dz': 'length',
  'caliber.Aeff': 'area',
  'caliber.pMaxZul': 'pressure',
  'caliber.ps': 'pressure',
  'caliber.sebert': 'one',
  'gun.twistlen': 'length',
  'gun.mgun': 'mass',
  'projectile.ProjectileName': 'text',
  'projectile.mname': 'text',
  'projectile.pname': 'text',
  'projectile.Dbul': 'length',
  'projectile.mp': 'mass',
  'projectile.glen': 'length',
  'projectile.g1bc': 'one',
  'projectile.g7bc': 'one',
  'propellant.mname': 'text',
  'propellant.pname': 'text',
  'propellant.lotid': 'text',
  'propellant.k': 'one',
  'propellant.pc': 'density',
  'propellant.pcd': 'density',
  'propellant.pt': 'temperature',
  'propellant.mc': 'mass',
} as const satisfies Record<string, Kind | 'text'>
type Field = keyof typeof fields

/** The solver values of the load that no component record holds, and the field each is read from. */
const overrideFields = [
  ['startPressure', 'caliber.ps'],
  ['sebert', 'caliber.sebert'],
  ['twist', 'gun.twistlen'],
  ['firearmMass', 'gun.mgun'],
  ['gamma', 'propellant.k'],
  ['density', 'propellant.pc'],
  ['propellantTemperature', 'propellant.pt'],
] as const

const shotshellWarning =
  'The file holds a shotshell load. This import is not checked on shotshell files: the fields it does not know are listed as not read. Check every value.'

/** The records of one load file, the fields it did not read and its warnings. */
export interface GrtLoadRead {
  records: UserRecord[]
  /** Fields with a value that no record field takes, as `section.name`. */
  unmapped: string[]
  warnings: string[]
}

export const elements = (e: XmlElement) =>
  e.children.filter((c): c is XmlElement => typeof c !== 'string')
const textOf = (e: XmlElement) => e.children.filter((c) => typeof c === 'string').join('')
export const clip = (s: string | undefined, max = 200) => (s ? s.slice(0, max) : undefined)
/** A number with `.` or a lone `,` as decimal mark; NaN otherwise. */
export const numberOf = (s: string) => Number(/^[-+]?\d+,\d+$/.test(s) ? s.replace(',', '.') : s)

/** Id, name and data of a record of `kind`, the id from its content: the same content gives the same id in every file. */
export const named = <D>(kind: string, name: string, data: D) => ({
  id: idOfKey(`${kind}|${JSON.stringify([name, data])}`),
  name,
  data,
})

/** The values of a file's fields: what the records are built from. */
interface Read {
  texts: Partial<Record<Field, string>>
  nums: Partial<Record<Field, number>>
  notes: string[]
  title?: string | undefined
  unmapped: Set<string>
  warnings: string[]
}

/** Text with its percent escapes resolved; the text as written, with a warning, when they are not valid. */
export function unescaped(s: string, at: string, warnings: string[]) {
  try {
    return decodeURIComponent(s).trim()
  } catch {
    warnings.push(`${at}: the text is not percent-encoded; it is read as written.`)
    return s.trim()
  }
}

/** The number of field `at` in the stored unit of `kind`; undefined, with a warning, when the unit or number is not read. */
function numberValue(at: string, kind: Kind, f: XmlElement, value: string, warnings: string[]) {
  const unit = f.attributes.unit ?? ''
  const factor = Object.hasOwn(factors[kind], unit) ? factors[kind][unit] : undefined
  const x = numberOf(value)
  if (factor !== undefined && Number.isFinite(x)) return Number((x * factor).toPrecision(12))
  warnings.push(
    `${at}: "${value.slice(0, 40)}" in unit "${unit.slice(0, 20)}" is not converted; the field is not read.`,
  )
}

/** One `input` field of a section into `read`. */
function readField(at: string, f: XmlElement, read: Read) {
  const value = (f.attributes.value ?? '').trim()
  if (value === '') return
  if (at === 'caliber.shotshell') {
    if (value === 'true') read.warnings.push(shotshellWarning)
    return
  }
  const kind = Object.hasOwn(fields, at) ? fields[at as Field] : undefined
  if (!kind) read.unmapped.add(at)
  else if (kind === 'text') read.texts[at as Field] = unescaped(value, at, read.warnings)
  else {
    const x = numberValue(at, kind, f, value, read.warnings)
    if (x !== undefined) read.nums[at as Field] = x
  }
}

/** The notes of the appendix into `read`; its measurements, pictures and other parts are not read. */
function readAppendix(appendix: XmlElement, read: Read) {
  for (const a of elements(appendix)) {
    if (a.name === 'note' && a.attributes.text)
      read.notes.push(unescaped(a.attributes.text, 'note', read.warnings))
    else read.unmapped.add(`appendix.${a.name}`)
  }
}

/** The fields of the file's load input, every section and field it does not read listed. */
function readInput(input: XmlElement): Read {
  const read: Read = { texts: {}, nums: {}, notes: [], unmapped: new Set(), warnings: [] }
  for (const section of elements(input)) {
    const s = section.name
    if (s === 'title') read.title = unescaped(textOf(section), s, read.warnings)
    else if (s === 'appendix') readAppendix(section, read)
    else if (['caliber', 'gun', 'projectile', 'propellant'].includes(s))
      for (const f of elements(section)) readField(`${s}.${f.attributes.name ?? f.name}`, f, read)
    else read.unmapped.add(section.attributes.name ? `${s}.${section.attributes.name}` : s)
  }
  return read
}

const quantity = (v: number | undefined) => (v === undefined ? undefined : { value: v })

function cartridgeOf(r: Read, name: string, saved: string): UserRecord {
  const spec = (
    symbol: string,
    quantity: 'length' | 'area' | 'pressure',
    f: Field,
    side?: 'cartridge' | 'chamber',
  ) => {
    const value = r.nums[f]
    return value === undefined ? [] : [{ ...(side && { side }), symbol, quantity, value }]
  }
  const values = [
    ...spec('L3', 'length', 'caliber.caselen', 'cartridge'),
    ...spec('Z', 'length', 'caliber.Dz', 'chamber'),
    ...spec('Q', 'area', 'caliber.Aeff', 'chamber'),
    ...spec('Pmax', 'pressure', 'caliber.pMaxZul'),
  ]
  const data = {
    origin: 'user' as const,
    overrides: { name, ...(values.length > 0 && { values }) },
  }
  return { kind: 'cartridge', ...named('cartridge', name, data), saved }
}

/** The bullet, and its maker's record first when the file names one. */
function bulletOf(r: Read, name: string, saved: string): UserRecord[] {
  const maker = clip(r.texts['projectile.mname'])
  const makerId = maker && idOfKey(`manufacturer|${keyText(maker)}`)
  const coefficients = (['G1', 'G7'] as const).flatMap((m) => {
    const value = r.nums[m === 'G1' ? 'projectile.g1bc' : 'projectile.g7bc']
    return value !== undefined && value > 0 ? [{ dragModel: m, value }] : []
  })
  const diameter = quantity(r.nums['projectile.Dbul'])
  const mass = quantity(r.nums['projectile.mp'])
  const length = quantity(r.nums['projectile.glen'])
  const data = {
    origin: 'user' as const,
    ...(makerId && { manufacturer: `user:${makerId}` as const }),
    overrides: {
      name: clip(r.texts['projectile.pname']) ?? name,
      ...(diameter && { diameter }),
      ...(mass && { mass }),
      ...(length && { length }),
      ...(coefficients.length > 0 && { ballisticCoefficients: coefficients }),
    },
  }
  const bullet: UserRecord = { kind: 'bullet', ...named('bullet', name, data), saved }
  return maker && makerId
    ? [{ kind: 'manufacturer', id: makerId, name: maker, saved, data: { origin: 'user' } }, bullet]
    : [bullet]
}

function powderOf(r: Read, name: string, saved: string): UserRecord {
  const bulk = quantity(r.nums['propellant.pcd'])
  const data = { origin: 'user' as const, draft: { ...(bulk && { bulkDensity: bulk }) } }
  return { kind: 'powder', ...named('powder', name, data), saved }
}

/** The load, naming the component records by `user:<id>`. */
function loadOf(
  r: Read,
  name: string,
  saved: string,
  refs: {
    cartridge?: string | undefined
    bullet?: string | undefined
    powder?: string | undefined
  },
): UserRecord {
  const overrides = Object.fromEntries(
    overrideFields.flatMap(([key, f]) => {
      const value = r.nums[f]
      return value === undefined ? [] : [[key, value]]
    }),
  )
  const charge = r.nums['propellant.mc'] ?? 0
  const oal = r.nums['caliber.oal'] ?? 0
  const lot = clip(r.texts['propellant.lotid'])
  const note = clip(r.notes.filter(Boolean).join('\n\n'), 10000)
  const ref = (id: string | undefined) => (id ? (`user:${id}` as const) : undefined)
  const [cartridge, bullet, powder] = [ref(refs.cartridge), ref(refs.bullet), ref(refs.powder)]
  const data = {
    origin: 'user' as const,
    ...(cartridge && { cartridge }),
    ...(bullet && { bullet }),
    ...(powder && { powder }),
    ...(lot && { powderLot: lot }),
    ...(charge > 0 && { charge: { value: charge } }),
    ...(oal > 0 && { seating: { by: 'overallLength' as const, value: { value: oal } } }),
    ...(note && { note }),
    ...(Object.keys(overrides).length > 0 && { analysis: { overrides } }),
  }
  return { kind: 'load', ...named('load', name, data), saved }
}

/**
 * The records of the load input element of a file of this layout (GRT's, also written by other
 * programs): the cartridge, the bullet after its maker, the powder, then the load last.
 */
export function readLoadInput(input: XmlElement, saved: string): GrtLoadRead {
  const r = readInput(input)
  const cartridgeName = clip(r.texts['caliber.CaliberName'])
  const bulletName = clip(r.texts['projectile.ProjectileName'] ?? r.texts['projectile.pname'])
  const powderName = clip(
    [r.texts['propellant.mname'], r.texts['propellant.pname']].filter(Boolean).join(' '),
  )
  const cartridge = cartridgeName ? cartridgeOf(r, cartridgeName, saved) : undefined
  const bullet = bulletName ? bulletOf(r, bulletName, saved) : []
  const powder = powderName ? powderOf(r, powderName, saved) : undefined
  const loadName =
    clip(r.title) ??
    clip([cartridgeName, bulletName, powderName].filter(Boolean).join(', ')) ??
    'Load'
  const load = loadOf(r, loadName, saved, {
    cartridge: cartridge?.id,
    bullet: bullet.at(-1)?.id,
    powder: powder?.id,
  })
  const records = [cartridge, ...bullet, powder, load].filter((x) => x !== undefined)
  return { records, unmapped: [...r.unmapped], warnings: r.warnings }
}

/**
 * The records of a load file: the cartridge, the bullet (after its maker) and the powder it names,
 * then the load, saved at `saved` (ISO 8601). Percent escapes in text values are resolved, numbers converted
 * from the unit each field declares to the stored unit; a field with an empty value holds nothing
 * to read. Ids come from the content, so a file read again gives the same records and files that
 * share a component give it one id. Throws with the reason on a file that is no load file of this
 * format. The caller checks each record with the user record schema.
 */
export function readGrtLoad(xml: string, saved: string): GrtLoadRead {
  const root = parseXml(xml.replace(/^\uFEFF/, ''))
  if (root.name !== grtLoadRoot) throw new Error(`The root element is not ${grtLoadRoot}.`)
  const input = elements(root).find((e) => e.name === 'InnerBallistikInput')
  if (!input) throw new Error('The file holds no load.')
  return readLoadInput(input, saved)
}
