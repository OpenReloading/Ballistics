import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { UsageError } from './errors.ts'

/** One load row: records by id, the load and the printed result. */
export interface Row {
  /** 1-based line in its file. */
  line: number
  cartridge: string
  bullet: string
  powder: string
  /** Charge, g. */
  charge: number
  /** Printed muzzle velocity, m/s. */
  velocity: number
  /** Printed peak pressure, bar. */
  pressure?: number | undefined
  /** Barrel length, mm. */
  barrel?: number | undefined
  /** Propellant temperature, degC. */
  temperature?: number | undefined
  /** Cartridge overall length, mm. */
  coal?: number | undefined
  /** The basis the printed peak pressure was measured on (free text), carried, not read yet. */
  pressureBasis?: string | undefined
  /** Bullet bearing length, mm, carried, not read yet. */
  bearing?: number | undefined
  /** Distance of the chronograph from the muzzle, m, carried, not read yet. */
  muzzleDistance?: number | undefined
  /** Session, rifle and lot ids (free text), carried, not read yet. */
  session?: string | undefined
  rifle?: string | undefined
  lot?: string | undefined
  /** A free label of the source table: carried with the row, never part of a result. */
  table?: string | undefined
}

/** The rows of a path and the bytes they were read from. */
export interface RowFiles {
  rows: Row[]
  /** The content of each file, in the order the rows were read. */
  files: Buffer[]
}

/** The columns of a rows file, with the kind of value each takes. */
const columns = {
  cartridge: 'id',
  bullet: 'id',
  powder: 'id',
  charge_g: 'positive',
  velocity_ms: 'positive',
  pressure_bar: 'positive',
  barrel_mm: 'positive',
  temperature_c: 'temperature',
  coal_mm: 'positive',
  bearing_mm: 'positive',
  muzzle_distance_m: 'positive',
  pressure_basis: 'text',
  session: 'text',
  rifle: 'text',
  lot: 'text',
  table: 'text',
} as const
type Column = keyof typeof columns
const required: Column[] = ['cartridge', 'bullet', 'powder', 'charge_g', 'velocity_ms']
/** Most problems one file reports before the rest is counted only. */
const reportLimit = 10

/** One cell: a double-quoted field (doubled quotes inside) or plain text, and what ends it. */
const cell = /(?:"((?:[^"]|"")*)"|([^,"\r\n]*))(,|\r?\n|$)/y

/** The fields of the CSV records of `text`: commas, double-quoted fields, LF or CRLF; blank lines are skipped. */
function records(text: string, name: string): { fields: string[]; line: number }[] {
  const out: { fields: string[]; line: number }[] = []
  let fields: string[] = []
  let line = 1
  let start = 1
  for (let at = 0; ; ) {
    cell.lastIndex = at
    const m = cell.exec(text)
    if (!m) throw new UsageError(`${name}:${line}: a quote is misplaced or not closed`)
    const [whole, quoted, plain = '', end] = m
    fields.push(quoted === undefined ? plain : quoted.replaceAll('""', '"'))
    line += whole.split('\n').length - 1
    at += whole.length
    if (end === ',') continue
    if (fields.length > 1 || fields[0] !== '') out.push({ fields, line: start })
    fields = []
    start = line
    if (end === '') return out
  }
}

/** The problem with a value of the kind `kind`, or undefined. The value itself is never quoted. */
function valueProblem(kind: (typeof columns)[Column], value: string): string | undefined {
  if (kind === 'text') return undefined
  if (kind === 'id') return value === '' ? 'is empty' : undefined
  if (value === '') return undefined
  const x = Number(value)
  if (!Number.isFinite(x)) return 'is not a number'
  if (kind === 'positive' && x <= 0) return 'must be above 0'
  return kind === 'temperature' && x <= -273.15 ? 'must be above -273.15' : undefined
}

/** The problems of the cells of one record, as `column: problem`. */
function cellProblems(fields: string[], header: Column[]): string[] {
  return header.flatMap((name, i) => {
    const value = (fields[i] ?? '').trim()
    const problem = valueProblem(columns[name], value)
    if (problem) return [`${name} ${problem}`]
    return value === '' && required.includes(name) ? [`${name} is empty`] : []
  })
}

/** `fields` as a row, or the problems of its cells. */
function toRow(
  fields: string[],
  line: number,
  header: Column[],
): { row: Row } | { problems: string[] } {
  if (fields.length !== header.length)
    return { problems: [`has ${fields.length} fields, the header has ${header.length}`] }
  const problems = cellProblems(fields, header)
  if (problems.length > 0) return { problems }
  const cell = (name: Column) => {
    const i = header.indexOf(name)
    return i < 0 ? '' : (fields[i] ?? '').trim()
  }
  const num = (name: Column) => (cell(name) === '' ? undefined : Number(cell(name)))
  return {
    row: {
      line,
      cartridge: cell('cartridge'),
      bullet: cell('bullet'),
      powder: cell('powder'),
      charge: Number(cell('charge_g')),
      velocity: Number(cell('velocity_ms')),
      pressure: num('pressure_bar'),
      barrel: num('barrel_mm'),
      temperature: num('temperature_c'),
      coal: num('coal_mm'),
      bearing: num('bearing_mm'),
      muzzleDistance: num('muzzle_distance_m'),
      pressureBasis: cell('pressure_basis') || undefined,
      session: cell('session') || undefined,
      rifle: cell('rifle') || undefined,
      lot: cell('lot') || undefined,
      table: cell('table') || undefined,
    },
  }
}

/** The header columns of a file, or the problem with its header. */
function headerOf(fields: string[]): Column[] | string {
  const names = fields.map((f) => f.trim())
  const unknown = names.filter((n) => !Object.hasOwn(columns, n))
  if (unknown.length > 0) return `the header has ${unknown.length} unknown column(s)`
  if (new Set(names).size !== names.length) return 'the header repeats a column'
  const missing = required.filter((r) => !names.includes(r))
  return missing.length > 0 ? `the header lacks ${missing.join(', ')}` : (names as Column[])
}

/** The rows of one CSV file's text; a `UsageError` lists each problem as file, line and reason. */
export function parseRows(text: string, name: string): Row[] {
  const [head, ...body] = records(text.replace(/^\uFEFF/, ''), name)
  if (!head) throw new UsageError(`${name}: the file is empty`)
  const header = headerOf(head.fields)
  if (typeof header === 'string') throw new UsageError(`${name}:${head.line}: ${header}`)
  const rows: Row[] = []
  const problems: string[] = []
  for (const { fields, line } of body) {
    const parsed = toRow(fields, line, header)
    if ('row' in parsed) rows.push(parsed.row)
    else problems.push(`${name}:${line}: ${parsed.problems.join('; ')}`)
  }
  if (problems.length > 0)
    throw new UsageError(
      [
        ...problems.slice(0, reportLimit),
        ...(problems.length > reportLimit ? [`${problems.length - reportLimit} more`] : []),
      ].join('\n'),
    )
  return rows
}

/** The `.csv` files of a folder in name order, or the file itself. */
function filesOf(path: string): string[] {
  let isDirectory: boolean
  try {
    isDirectory = statSync(path).isDirectory()
  } catch {
    throw new UsageError('the rows path does not exist')
  }
  if (!isDirectory) return [path]
  const names = readdirSync(path)
    .filter((n) => n.endsWith('.csv'))
    .toSorted()
  if (names.length === 0) throw new UsageError('the rows folder holds no .csv file')
  return names.map((n) => join(path, n))
}

/** Reads the rows of a file, or of every `.csv` file of a folder. */
export function readRows(path: string): RowFiles {
  const files = filesOf(path).map((file) => ({ file, bytes: readFileSync(file) }))
  const rows = files.flatMap(({ file, bytes }) =>
    parseRows(bytes.toString('utf8'), file.split('/').at(-1) ?? file),
  )
  if (rows.length === 0) throw new UsageError('the rows file holds no row')
  return { rows, files: files.map((f) => f.bytes) }
}
