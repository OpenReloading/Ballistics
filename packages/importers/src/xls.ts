// Legacy Excel workbooks: BIFF8 records ([MS-XLS] Excel Binary File Format (.xls) Structure,
// v20250819, https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-xls/cd03cb5f-ca02-4934-a391-bb674cb8aa06;
// section numbers below refer to it) in the Workbook stream of a compound file, read into the
// same rows of cell text as XLSX workbooks.
import { type CellBudget, clean, placeCell, type Workbook, type Worksheet } from './cells.ts'
import { compoundStreams } from './cfb.ts'
import { maxCellCharacters, maxCells, maxPartSize } from './limits.ts'

// record types (2.3)
const BOF = 0x0809
const EOF = 0x000a
const CONTINUE = 0x003c
const FILEPASS = 0x002f
const BOUNDSHEET8 = 0x0085
const SST = 0x00fc
const STRING = 0x0207
const LABELSST = 0x00fd
const LABEL = 0x0204
const NUMBER = 0x0203
const RK = 0x027e
const MULRK = 0x00bd
const FORMULA = 0x0006
const BOOLERR = 0x0205
const BLANK = 0x0201
const MULBLANK = 0x00be
const cellRecords = new Set([LABELSST, LABEL, NUMBER, RK, MULRK, FORMULA, BOOLERR, BLANK, MULBLANK])

const encrypted = 'encrypted workbooks are not read; save the workbook without a password'
const biff8Only =
  'only BIFF8 .xls workbooks (Excel 97 to 2003) are read; save the workbook as .xlsx or export CSV'

// BErr (2.5.198.2): the text an XLSX error cell holds
const errors = new Map([
  [0x00, '#NULL!'],
  [0x07, '#DIV/0!'],
  [0x0f, '#VALUE!'],
  [0x17, '#REF!'],
  [0x1d, '#NAME?'],
  [0x24, '#NUM!'],
  [0x2a, '#N/A'],
])

interface Rec {
  type: number
  /** Byte position of the record in the stream. */
  at: number
  /** End of the record's own data; its Continue records follow up to `next`. */
  end: number
  /** Position of the next record that is not a Continue record. */
  next: number
}

/** End of data inside a string read; turned into a message by the caller. */
class Short extends Error {}

/**
 * A cursor over the data of a record and of the Continue records after it (2.1.4), read from the
 * stream in place: a Continue header is read when the cursor reaches the end of a chunk.
 */
class Cursor {
  private s: Uint8Array
  private at: number
  private end: number
  constructor(s: Uint8Array, at: number, end: number) {
    this.s = s
    this.at = at
    this.end = end
  }
  /** Moves to the next Continue record; false when there is none. */
  private advance(): boolean {
    const s = this.s
    const e = this.end
    if (e + 4 > s.length || (this.byte(e) | (this.byte(e + 1) << 8)) !== CONTINUE) return false
    this.at = e + 4
    this.end = this.at + (this.byte(e + 2) | (this.byte(e + 3) << 8))
    return true
  }
  /** Byte `k` of the stream; the records and Continue chunks were checked to lie inside it. */
  private byte(k: number): number {
    const b = this.s[k]
    if (b === undefined) throw new Short()
    return b
  }
  private ready() {
    while (this.at >= this.end) if (!this.advance()) throw new Short()
  }
  u8(): number {
    this.ready()
    return this.byte(this.at++)
  }
  u16(): number {
    return this.u8() | (this.u8() << 8)
  }
  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0
  }
  skip(n: number) {
    for (let left = n; left > 0; ) {
      this.ready()
      const step = Math.min(left, this.end - this.at)
      this.at += step
      left -= step
    }
  }
  /**
   * `count` characters with high-byte flag `high`; a chunk that ends while characters remain is
   * followed by one starting with a new flag byte (2.5.293). Built 4096 code units at a time.
   */
  characters(count: number, high: boolean): string {
    let text = ''
    let left = count
    let wide = high
    while (left > 0) {
      if (this.at >= this.end) {
        if (!this.advance()) throw new Short()
        wide = (this.u8() & 1) === 1
      }
      const room = wide ? Math.floor((this.end - this.at) / 2) : this.end - this.at
      if (room === 0) throw new Short()
      const n = Math.min(left, room, 4096)
      text += this.codeUnits(n, wide)
      left -= n
    }
    return text
  }
  /** `n` characters from the cursor inside the current chunk, one or two bytes each. */
  private codeUnits(n: number, wide: boolean): string {
    const codes = new Array<number>(n)
    for (let i = 0; i < n; i++) {
      const k = this.at + (wide ? 2 * i : i)
      codes[i] = wide ? this.byte(k) | (this.byte(k + 1) << 8) : this.byte(k)
    }
    this.at += wide ? 2 * n : n
    return String.fromCharCode(...codes)
  }
  /** XLUnicodeString (2.5.294): `u16` count, flag byte, characters. */
  unicodeString(): string {
    const count = this.u16()
    return this.characters(count, (this.u8() & 1) === 1)
  }
  /** XLUnicodeRichExtendedString (2.5.293); throws `Short` or a malformed-string message. */
  richString(): string {
    const count = this.u16()
    const flags = this.u8()
    const runs = flags & 8 ? this.u16() : 0
    const phonetic = flags & 4 ? this.u32() : 0
    if (phonetic > 0x7fffffff) throw new Error('phonetic size is negative')
    const text = this.characters(count, (flags & 1) === 1)
    this.skip(4 * runs + phonetic)
    return text
  }
}

/** Column letters for a column number from 1 (bijective base 26). */
function letters(column: number): string {
  let s = ''
  for (let c = column; c > 0; c = Math.floor((c - 1) / 26)) {
    s = String.fromCharCode(65 + ((c - 1) % 26)) + s
  }
  return s
}

/** RkNumber (2.5.217): a 30-bit integer or the high 30 bits of a double, divided by 100 when flagged. */
function rk(u: number): number {
  let x: number
  if (u & 2) x = u >> 2
  else {
    const view = new DataView(new ArrayBuffer(8))
    view.setUint32(4, (u & 0xfffffffc) >>> 0, true)
    x = view.getFloat64(0, true)
  }
  return u & 1 ? x / 100 : x
}

/** A string read, with running out of data reported as a malformed string. */
function readText(read: () => string): string {
  try {
    return read()
  } catch (e) {
    if (e instanceof Short) throw new Error('string record is malformed')
    throw e
  }
}

/** Record access to the Workbook stream `s`. */
interface RecordReader {
  s: Uint8Array
  view: DataView
  /**
   * The record at byte `at` with the Continue records after it; throws when it runs past the
   * stream or when the bytes read over all calls exceed the stream (substreams overlap).
   */
  record(at: number): Rec
  /** True when the record is a BOF of BIFF8 with substream type `dt` (2.4.21). */
  isBof(r: Rec, dt: number): boolean
}

function recordReader(s: Uint8Array): RecordReader {
  const view = new DataView(s.buffer, s.byteOffset, s.byteLength)
  // bytes read over all substreams; more than the stream means substreams overlap
  let scanned = 0
  const record = (at: number): Rec => {
    if (at + 4 > s.length) {
      throw new Error(`XLS record at byte ${at} runs past the end of the Workbook stream`)
    }
    const type = view.getUint16(at, true)
    const end = at + 4 + view.getUint16(at + 2, true)
    if (end > s.length) {
      throw new Error(`XLS record at byte ${at} runs past the end of the Workbook stream`)
    }
    // Continue records are checked and stepped over here; only string readers enter them
    let next = end
    while (next + 4 <= s.length && view.getUint16(next, true) === CONTINUE) {
      const e = next + 4 + view.getUint16(next + 2, true)
      if (e > s.length) {
        throw new Error(`XLS record at byte ${next} runs past the end of the Workbook stream`)
      }
      next = e
    }
    scanned += next - at
    if (scanned > s.length) throw new Error('XLS sheet substreams overlap')
    return { type, at, end, next }
  }
  const isBof = (r: Rec, dt: number) =>
    r.type === BOF &&
    r.end - r.at >= 8 &&
    view.getUint16(r.at + 4, true) === 0x0600 &&
    view.getUint16(r.at + 6, true) === dt
  return { s, view, record, isBof }
}

/** `read()`, with a record that ends inside its data reported as too short. */
function whenShort<T>(r: Rec, read: () => T): T {
  try {
    return read()
  } catch (e) {
    if (!(e instanceof Short)) throw e
    throw new Error(`XLS record at byte ${r.at} is too short`)
  }
}

/** BoundSheet8 (2.4.28): the position, type and name of a sheet. */
function boundSheet(c: Cursor): { position: number; type: number; name: string } {
  const position = c.u32()
  c.u8()
  const type = c.u8()
  const count = c.u8()
  return { position, type, name: c.characters(count, (c.u8() & 1) === 1) }
}

/**
 * The workbook substream (2.1.7.20.3) from byte 0: the BoundSheet8 entries, the shared strings,
 * and the position after its EOF record.
 */
function readWorkbookSubstream(reader: RecordReader): {
  bound: { position: number; type: number; name: string }[]
  strings: string[]
  end: number
} {
  const { s, record, isBof } = reader
  const head = s.length < 4 ? undefined : record(0)
  if (!head || !isBof(head, 0x0005)) throw new Error(biff8Only)
  const bound: { position: number; type: number; name: string }[] = []
  let strings: string[] = []
  let p = head.next
  for (;;) {
    if (p >= s.length) throw new Error('XLS workbook substream has no EOF record')
    const r = record(p)
    p = r.next
    if (r.type === EOF) break
    if (r.type === FILEPASS) throw new Error(encrypted)
    if (r.type === BOUNDSHEET8) {
      bound.push(whenShort(r, () => boundSheet(new Cursor(s, r.at + 4, r.end))))
    } else if (r.type === SST) {
      strings = whenShort(r, () => sharedStrings(new Cursor(s, r.at + 4, r.end)))
    }
  }
  return { bound, strings, end: p }
}

/** Cells of a worksheet being read. */
interface SheetState {
  rows: Map<number, string[]>
  remaining: CellBudget
  /** A formula with a string result waits for its String record (2.1.7.20.5 FORMULA). */
  pending?: { row: number; col: number } | undefined
}

function put(st: SheetState, row: number, col: number, text: string): void {
  let cells = st.rows.get(row)
  if (!cells) {
    cells = []
    st.rows.set(row, cells)
  }
  placeCell(cells, col + 1, text, () => `${letters(col + 1)}${row + 1}`, st.remaining)
}

/** Refuses a formula cell still waiting for its String record. */
function checkNoPending(st: SheetState): void {
  if (!st.pending) return
  const ref = `${letters(st.pending.col + 1)}${st.pending.row + 1}`
  throw new Error(`formula cell ${ref} has no String record`)
}

/** How a record changes the nesting of substreams: a BOF opens one, an EOF closes one. */
const depthChange = (type: number) => (type === BOF ? 1 : type === EOF ? -1 : 0)

/** A cell record of the worksheet, with the places of its fields. */
interface CellRecord {
  r: Rec
  /** The record's data. */
  d: Uint8Array
  /** Byte position of the data. */
  o: number
  row: number
  col: number
}

const cellRef = (c: CellRecord, col = c.col) => `${letters(col + 1)}${c.row + 1}`

function need(c: CellRecord, size: number): void {
  if (c.d.length < size) throw new Error(`XLS record at byte ${c.r.at} is too short`)
}

/** Byte `k` of the record's data; a record shorter than the fields it must hold is refused. */
function dataByte(c: CellRecord, k: number): number {
  const b = c.d[k]
  if (b === undefined) throw new Error(`XLS record at byte ${c.r.at} is too short`)
  return b
}

function numberText(c: CellRecord, x: number, col = c.col): string {
  if (!Number.isFinite(x))
    throw new Error(`cell ${cellRef(c, col)} holds a number that is not finite`)
  return String(x)
}

function errorText(c: CellRecord, code: number): string {
  const t = errors.get(code)
  if (t === undefined) throw new Error(`cell ${cellRef(c)} holds an unknown error code ${code}`)
  return t
}

/** MulRk and MulBlank: a run of cells in one row, each with a number or empty. */
function putCellRun(reader: RecordReader, c: CellRecord, st: SheetState): void {
  const { view } = reader
  const item = c.r.type === MULRK ? 6 : 2
  const last = view.getUint16(c.o + c.d.length - 2, true)
  const size = c.d.length - 6
  if (last < c.col || size % item !== 0 || last - c.col + 1 !== size / item) {
    throw new Error(`XLS record at byte ${c.r.at} does not hold the cells it names`)
  }
  for (let k = 0; k <= last - c.col; k++) {
    const t =
      item === 6 ? numberText(c, rk(view.getUint32(c.o + 4 + 6 * k + 2, true)), c.col + k) : ''
    put(st, c.row, c.col + k, t)
  }
}

/** Formula (2.4.127): a cached number, or a boolean, error, empty or string result. */
function putFormula(reader: RecordReader, c: CellRecord, st: SheetState): void {
  const { view } = reader
  need(c, 14)
  if (view.getUint16(c.o + 12, true) !== 0xffff) {
    put(st, c.row, c.col, numberText(c, view.getFloat64(c.o + 6, true)))
    return
  }
  const type = dataByte(c, 6)
  if (type === 0) st.pending = { row: c.row, col: c.col }
  else if (type === 1) put(st, c.row, c.col, dataByte(c, 8) ? '1' : '')
  else if (type === 2) put(st, c.row, c.col, errorText(c, dataByte(c, 8)))
  else if (type === 3) put(st, c.row, c.col, '')
  else throw new Error(`formula cell ${cellRef(c)} holds an unknown value type ${type}`)
}

/** LabelSst (2.4.149): the shared string the cell refers to. */
function sharedCell(view: DataView, c: CellRecord, strings: string[]): string {
  need(c, 10)
  const k = view.getUint32(c.o + 6, true)
  const text = strings[k]
  if (text === undefined) {
    throw new Error(`cell ${cellRef(c)} refers to shared string ${k} of ${strings.length}`)
  }
  return text
}

/** BoolErr (2.4.24): an error code as its text, TRUE as `1`, FALSE as empty text. */
function boolErrText(c: CellRecord): string {
  need(c, 8)
  if (dataByte(c, 7)) return errorText(c, dataByte(c, 6))
  return dataByte(c, 6) ? '1' : ''
}

/** Places the cell or cells of one cell record. */
function putCell(reader: RecordReader, r: Rec, strings: string[], st: SheetState): void {
  const { s, view } = reader
  const d = s.subarray(r.at + 4, r.end)
  const o = r.at + 4
  const c: CellRecord = { r, d, o, row: 0, col: 0 }
  need(c, 6)
  c.row = view.getUint16(o, true)
  c.col = view.getUint16(o + 2, true)
  const { row, col } = c
  if (r.type === LABELSST) {
    put(st, row, col, sharedCell(view, c, strings))
  } else if (r.type === LABEL) {
    put(st, row, col, clean(readText(() => new Cursor(s, r.at + 10, r.end).unicodeString())))
  } else if (r.type === NUMBER) {
    need(c, 14)
    put(st, row, col, numberText(c, view.getFloat64(o + 6, true)))
  } else if (r.type === RK) {
    need(c, 10)
    put(st, row, col, numberText(c, rk(view.getUint32(o + 6, true))))
  } else if (r.type === MULRK || r.type === MULBLANK) {
    putCellRun(reader, c, st)
  } else if (r.type === FORMULA) {
    putFormula(reader, c, st)
  } else if (r.type === BOOLERR) {
    put(st, row, col, boolErrText(c))
  } else if (r.type === BLANK) {
    put(st, row, col, '')
  }
}

/**
 * Rows of the worksheet `n` whose records start at `from`, after its BOF, and the position after
 * its EOF record; cells are placed and counted against `remaining`.
 */
function readWorksheetCells(
  reader: RecordReader,
  from: number,
  n: number,
  strings: string[],
  remaining: CellBudget,
): { rows: string[][]; end: number } {
  const { s, record } = reader
  const st: SheetState = { rows: new Map(), remaining }
  let depth = 1
  let end = 0
  for (let at = from; ; ) {
    if (at >= s.length) throw new Error(`XLS worksheet ${n} has no EOF record`)
    const r = record(at)
    at = r.next
    depth += depthChange(r.type)
    if (depth === 0) {
      end = at
      checkNoPending(st)
      break
    }
    if (r.type === BOF) checkNoPending(st)
    // cells of nested substreams (embedded charts) are not cells of the worksheet
    if (depth !== 1) continue
    if (st.pending && r.type === STRING) {
      const text = clean(readText(() => new Cursor(s, r.at + 4, r.end).unicodeString()))
      put(st, st.pending.row, st.pending.col, text)
      st.pending = undefined
      continue
    }
    if (!cellRecords.has(r.type)) continue
    checkNoPending(st)
    putCell(reader, r, strings, st)
  }
  return { rows: [...st.rows].sort((a, b) => a[0] - b[0]).map(([, cells]) => cells), end }
}

/**
 * The worksheets (type 0) of the BoundSheet8 entries in workbook order; a worksheet that does not
 * start with a worksheet BOF, starts where another does, or lies inside another substream
 * (`workbookEnd` ends the workbook substream) is refused.
 */
function assembleWorksheets(
  reader: RecordReader,
  bound: { position: number; type: number; name: string }[],
  strings: string[],
  workbookEnd: number,
): Worksheet[] {
  const { s, record, isBof } = reader
  const remaining: CellBudget = { cells: maxCells, characters: maxCellCharacters }
  const starts = new Set<number>()
  // byte ranges of the substreams read; a worksheet inside another substream (for example at a
  // BOF nested in a chart) is refused once all are read
  const ranges: [number, number][] = [[0, workbookEnd]]
  const worksheets: Worksheet[] = []
  // only worksheets (and dialog sheets); macro, chart and VBA module sheets hold no cells
  for (const b of bound.filter((b) => b.type === 0)) {
    const n = worksheets.length + 1
    const first = b.position + 4 <= s.length ? record(b.position) : undefined
    if (!first || !isBof(first, 0x0010)) {
      throw new Error(`XLS worksheet ${n} does not start with a worksheet BOF record`)
    }
    if (starts.has(b.position)) {
      throw new Error(`XLS worksheet ${n} starts where an earlier worksheet starts`)
    }
    starts.add(b.position)
    try {
      const { rows, end } = readWorksheetCells(reader, first.next, n, strings, remaining)
      worksheets.push({ name: b.name, rows })
      ranges.push([b.position, end])
    } catch (e) {
      const message = (e as Error).message
      throw new Error(message.startsWith('XLS ') ? message : `XLS worksheet ${n}: ${message}`)
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  if (
    ranges.some(([start], k) => {
      const before = ranges[k - 1]
      return before !== undefined && start < before[1]
    })
  ) {
    throw new Error('XLS sheet substreams overlap')
  }
  return worksheets
}

/** The worksheets of a BIFF8 workbook in a compound file, in workbook order, as XLSX worksheets. */
export function readXls(bytes: Uint8Array): Workbook {
  const streams = compoundStreams(bytes, ['WORKBOOK', 'BOOK', 'ENCRYPTEDPACKAGE'])
  const read = streams.get('WORKBOOK') ?? streams.get('BOOK')
  if (!read) {
    if (streams.has('ENCRYPTEDPACKAGE')) throw new Error(encrypted)
    throw new Error('not an XLS workbook: no Workbook stream')
  }
  const reader = recordReader(read(maxPartSize))
  const { bound, strings, end } = readWorkbookSubstream(reader)
  return { worksheets: assembleWorksheets(reader, bound, strings, end) }
}

/** SST (2.4.265): `cstUnique` strings, each trimmed and U+FEFF removed once. */
function sharedStrings(c: Cursor): string[] {
  c.u32()
  const unique = c.u32()
  const strings: string[] = []
  while (strings.length < unique) {
    try {
      strings.push(clean(c.richString()))
    } catch (e) {
      if (e instanceof Short) {
        throw new Error(`XLS shared string table ends after ${strings.length} of ${unique} strings`)
      }
      throw new Error(`XLS shared string ${strings.length} is malformed: ${(e as Error).message}`)
    }
  }
  return strings
}
