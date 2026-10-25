/// <reference types="node" />

// Test .xls files written with Buffer, independent of the reader under test: BIFF8 records
// ([MS-XLS] 2.1.4, 2.4) in a compound file ([MS-CFB] 2.2 to 2.6).

import { defined } from './defined.ts'

const BOF = 0x0809
export const EOF = 0x000a
const CONTINUE = 0x003c

/** One record: type, size and data. */
export function record(type: number, data: Uint8Array = new Uint8Array()): Buffer {
  const head = Buffer.alloc(4)
  head.writeUInt16LE(type, 0)
  head.writeUInt16LE(data.length, 2)
  return Buffer.concat([head, data])
}

const u16 = (n: number) => {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}
const u32 = (n: number) => {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}
const units = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i))
const chars = (codes: number[], high: boolean) => {
  if (!high) return Buffer.from(codes)
  const b = Buffer.alloc(2 * codes.length)
  for (const [k, c] of codes.entries()) b.writeUInt16LE(c, 2 * k)
  return b
}

/** BOF record data: version, substream type ([MS-XLS] 2.4.21). */
export const bof = (dt: number, vers = 0x0600) =>
  record(BOF, Buffer.concat([u16(vers), u16(dt), Buffer.alloc(12)]))

/** Cell header: row, column, format index. */
const cell = (row: number, col: number) => Buffer.concat([u16(row), u16(col), u16(0)])

export const labelSst = (row: number, col: number, k: number) =>
  record(0x00fd, Buffer.concat([cell(row, col), u32(k)]))
export const numberCell = (row: number, col: number, x: number) => {
  const b = Buffer.alloc(8)
  b.writeDoubleLE(x)
  return record(0x0203, Buffer.concat([cell(row, col), b]))
}
export const rkCell = (row: number, col: number, rk: number) =>
  record(0x027e, Buffer.concat([cell(row, col), u32(rk)]))
export const mulRk = (row: number, first: number, rks: number[]) =>
  record(
    0x00bd,
    Buffer.concat([
      u16(row),
      u16(first),
      ...rks.flatMap((rk) => [u16(0), u32(rk)]),
      u16(first + rks.length - 1),
    ]),
  )
export const boolErr = (row: number, col: number, value: number, error: boolean) =>
  record(0x0205, Buffer.concat([cell(row, col), Buffer.from([value, error ? 1 : 0])]))
export const blank = (row: number, col: number) => record(0x0201, cell(row, col))
export const mulBlank = (row: number, first: number, count: number) =>
  record(
    0x00be,
    Buffer.concat([
      u16(row),
      u16(first),
      ...Array.from({ length: count }, () => u16(0)),
      u16(first + count - 1),
    ]),
  )
/** Formula with a cached value: 8 bytes of FormulaValue, then flags, chn and an empty formula. */
export const formula = (row: number, col: number, value: Buffer) =>
  record(0x0006, Buffer.concat([cell(row, col), value, u16(0), u32(0), u16(0)]))
export const formulaNumber = (x: number) => {
  const b = Buffer.alloc(8)
  b.writeDoubleLE(x)
  return b
}
/** FormulaValue of a non-number result: type 0 string, 1 boolean, 2 error, 3 empty. */
export const formulaOther = (type: number, value = 0) =>
  Buffer.from([type, 0, value, 0, 0, 0, 0xff, 0xff])

/** RK value of an integer (fInt), optionally with fX100. */
export const rkInt = (n: number, x100 = false) => ((n << 2) | 2 | (x100 ? 1 : 0)) >>> 0
/** RK value from the high 32 bits of a double, optionally with fX100. */
export const rkFloat = (x: number, x100 = false) => {
  const b = Buffer.alloc(8)
  b.writeDoubleLE(x)
  return ((b.readUInt32LE(4) & 0xfffffffc) | (x100 ? 1 : 0)) >>> 0
}

/**
 * Writes record data that may continue in Continue records of at most `chunk` bytes. Fixed
 * fields stay in one record; characters that do not fit go on in the next record after a flag
 * byte; run and phonetic bytes are split anywhere.
 */
class Records {
  private out: Buffer[] = []
  private current: number[] = []
  private type: number
  private chunk: number
  constructor(type: number, chunk: number) {
    this.type = type
    this.chunk = chunk
  }
  private flush() {
    this.out.push(record(this.type, Buffer.from(this.current)))
    this.type = CONTINUE
    this.current = []
  }
  private get room() {
    return this.chunk - this.current.length
  }
  fixed(bytes: Uint8Array) {
    if (bytes.length > this.room) this.flush()
    this.current.push(...bytes)
  }
  loose(bytes: Uint8Array) {
    for (const b of bytes) {
      if (this.room === 0) this.flush()
      this.current.push(b)
    }
  }
  /** A string header (`fixed`) then its characters, each record part with its own flag. */
  string(header: Buffer, flagAt: number, codes: number[]) {
    this.fixed(header)
    const flagIndex = this.current.length - header.length + flagAt
    let first = true
    let k = 0
    while (k < codes.length || first) {
      if (!first) {
        this.flush()
        this.current.push(0) // flag byte, set below
      }
      const flagPos = first ? flagIndex : 0
      const narrow = Math.min(this.room, codes.length - k)
      const high = codes.slice(k, k + narrow).some((c) => c > 0xff)
      const n = high ? Math.min(Math.floor(this.room / 2), codes.length - k) : narrow
      this.current[flagPos] = (defined(this.current[flagPos]) & ~1) | (high ? 1 : 0)
      this.current.push(...chars(codes.slice(k, k + n), high))
      k += n
      first = false
      if (k < codes.length && n === 0 && this.room === this.chunk - 1) {
        throw new Error('chunk too small')
      }
    }
  }
  done(): Buffer {
    this.flush()
    return Buffer.concat(this.out)
  }
}

interface RichString {
  text: string
  /** Formatting runs (4 bytes each). */
  runs?: number
  /** Phonetic data bytes. */
  phonetic?: number
}

/** An SST record with Continue records of at most `chunk` bytes. */
export function sst(strings: (string | RichString)[], chunk = 8224): Buffer {
  const r = new Records(0x00fc, chunk)
  r.fixed(Buffer.concat([u32(strings.length), u32(strings.length)]))
  for (const item of strings) {
    const s = typeof item === 'string' ? { text: item } : item
    const runs = s.runs ?? 0
    const phonetic = s.phonetic ?? 0
    const flags = (runs ? 8 : 0) | (s.phonetic !== undefined ? 4 : 0)
    const header = Buffer.concat([
      u16(s.text.length),
      Buffer.from([flags]),
      runs ? u16(runs) : Buffer.alloc(0),
      s.phonetic !== undefined ? u32(phonetic) : Buffer.alloc(0),
    ])
    r.string(header, 2, units(s.text))
    r.loose(Buffer.alloc(4 * runs, 0x11))
    r.loose(Buffer.alloc(phonetic, 0x22))
  }
  return r.done()
}

/** A record holding an XLUnicodeString after `before`, continued in records of `chunk` bytes. */
export function stringRecord(type: number, before: Buffer, text: string, chunk = 8224): Buffer {
  const r = new Records(type, chunk)
  r.fixed(before)
  r.string(Buffer.concat([u16(text.length), Buffer.from([0])]), 2, units(text))
  return r.done()
}
export const label = (row: number, col: number, text: string) =>
  stringRecord(0x0204, cell(row, col), text)

interface XlsSheet {
  name: string
  rows?: string[][]
  /** Records written after the cells. */
  records?: Buffer[]
  /** BoundSheet8 type: 0 worksheet (default), 1 macro, 2 chart, 6 VBA module. */
  type?: number
  /** BoundSheet8 hidden state: 0 visible, 1 hidden, 2 very hidden. */
  hidden?: number
}

interface WorkbookStreamOptions {
  /** Write empty texts as LabelSst cells too. */
  empty?: boolean
  /** Largest record data of the SST and its Continue records. */
  sstChunk?: number
  filePass?: boolean
  /** Version of the workbook BOF. */
  bofVersion?: number
  /** Changes the BoundSheet8 positions before they are written. */
  positions?: (positions: number[]) => number[]
  /** Leave out the EOF of each worksheet. */
  noSheetEof?: boolean
  /** Extra strings at the end of the shared string table. */
  strings?: (string | RichString)[]
}

/** A BIFF8 Workbook stream; every non-empty text is a LabelSst cell at its row and column. */
export function workbookStream(sheets: XlsSheet[], options: WorkbookStreamOptions = {}): Buffer {
  const strings: (string | RichString)[] = []
  const index = new Map<string, number>()
  const bodies = sheets.map((s) => {
    const cells = (s.rows ?? []).flatMap((row, r) =>
      row.flatMap((text, c) => {
        if (!text && !options.empty) return []
        let k = index.get(text)
        if (k === undefined) {
          k = strings.push(text) - 1
          index.set(text, k)
        }
        return [labelSst(r, c, k)]
      }),
    )
    return Buffer.concat([
      bof(0x0010),
      ...cells,
      ...(s.records ?? []),
      options.noSheetEof ? Buffer.alloc(0) : record(EOF),
    ])
  })
  strings.push(...(options.strings ?? []))
  const boundSheet = (s: XlsSheet, position: number) => {
    const name = units(s.name)
    const high = name.some((c) => c > 0xff)
    return record(
      0x0085,
      Buffer.concat([
        u32(position),
        Buffer.from([s.hidden ?? 0, s.type ?? 0, name.length, high ? 1 : 0]),
        chars(name, high),
      ]),
    )
  }
  const globals = (positions: number[]) =>
    Buffer.concat([
      bof(0x0005, options.bofVersion),
      options.filePass ? record(0x002f, Buffer.alloc(6)) : Buffer.alloc(0),
      record(0x0042, u16(1200)),
      ...sheets.map((s, i) => boundSheet(s, defined(positions[i]))),
      sst(strings, options.sstChunk),
      record(EOF),
    ])
  const size = globals(sheets.map(() => 0)).length
  let at = size
  const positions = bodies.map((b) => {
    const p = at
    at += b.length
    return p
  })
  return Buffer.concat([globals(options.positions?.(positions) ?? positions), ...bodies])
}

interface CompoundOptions {
  version?: 3 | 4
  /** At least this many FAT sectors; above 109 they are listed through DIFAT sectors. */
  fatSectors?: number
  /** Changes the file after writing; `layout` names where things are. */
  patch?: (file: Buffer, layout: Layout) => void
}

export interface Layout {
  sectorSize: number
  /** Byte offset of sector n. */
  offset: (n: number) => number
  /** Byte offset of FAT entry n. */
  fatEntry: (n: number) => number
  /** Byte offset of directory entry id. */
  entry: (id: number) => number
  /** First sector of each stream in FAT sectors, by stream index (undefined in the mini stream). */
  starts: (number | undefined)[]
}

const ENDOFCHAIN = 0xfffffffe
const FREESECT = 0xffffffff
const NOSTREAM = 0xffffffff

type CompoundStream = { name: string; data: Uint8Array }

/** Where a compound file puts its sectors. */
interface CompoundPlan {
  version: 3 | 4
  sectorSize: number
  /** FAT entries per sector. */
  per: number
  big: boolean[]
  miniStarts: number[]
  miniStream: Buffer
  miniSectors: number
  miniFatSectors: number
  dirSectors: number
  fat: number
  difat: number
  /** The FAT, one entry per sector. */
  table: number[]
  difatStart: number
  fatStart: number
  dirStart: number
  miniFatStart: number
  miniStart: number
  starts: (number | undefined)[]
  total: number
}

/** The small streams in 64-byte mini sectors: their first mini sectors and the whole mini stream. */
function miniLayout(streams: CompoundStream[], big: boolean[]) {
  const miniStarts: number[] = []
  const miniChunks: Buffer[] = []
  let miniCount = 0
  for (const [i, s] of streams.entries()) {
    if (big[i]) continue
    miniStarts[i] = s.data.length ? miniCount : ENDOFCHAIN
    const n = Math.ceil(s.data.length / 64)
    miniChunks.push(Buffer.concat([s.data, Buffer.alloc(n * 64 - s.data.length)]))
    miniCount += n
  }
  return { miniStarts, miniStream: Buffer.concat(miniChunks), miniCount }
}

/** The FAT and DIFAT sector counts for `content` other sectors, at least `minimum` FAT sectors. */
function fatCounts(content: number, per: number, minimum: number): { fat: number; difat: number } {
  let fat = Math.max(1, minimum)
  let difat = 0
  for (;;) {
    const d = Math.max(0, Math.ceil((fat - 109) / (per - 1)))
    const f = Math.max(fat, Math.ceil((content + fat + d) / per))
    if (d === difat && f === fat) return { fat, difat }
    difat = d
    fat = f
  }
}

function planCompound(streams: CompoundStream[], options: CompoundOptions): CompoundPlan {
  const version = options.version ?? 3
  const sectorSize = version === 3 ? 512 : 4096
  const per = sectorSize / 4
  const big = streams.map((s) => s.data.length >= 4096)
  const { miniStarts, miniStream, miniCount } = miniLayout(streams, big)
  const miniSectors = Math.ceil(miniStream.length / sectorSize)
  const miniFatSectors = Math.ceil(miniCount / per)
  const dirSectors = Math.ceil((1 + streams.length) / (sectorSize / 128))
  const bigSectors = streams.map((s, i) => (big[i] ? Math.ceil(s.data.length / sectorSize) : 0))
  const content = dirSectors + miniFatSectors + miniSectors + bigSectors.reduce((a, b) => a + b, 0)
  const { fat, difat } = fatCounts(content, per, options.fatSectors ?? 0)
  const table = new Array<number>(fat * per).fill(FREESECT)
  let next = 0
  const run = (count: number, mark?: number) => {
    const start = next
    for (let k = 0; k < count; k++)
      table[next + k] = mark ?? (k === count - 1 ? ENDOFCHAIN : next + k + 1)
    next += count
    return count ? start : ENDOFCHAIN
  }
  const difatStart = run(difat, 0xfffffffc)
  const fatStart = run(fat, 0xfffffffd)
  const dirStart = run(dirSectors)
  const miniFatStart = run(miniFatSectors)
  const miniStart = run(miniSectors)
  const starts = streams.map((_, i) => (big[i] ? run(defined(bigSectors[i])) : undefined))
  return {
    version,
    sectorSize,
    per,
    big,
    miniStarts,
    miniStream,
    miniSectors,
    miniFatSectors,
    dirSectors,
    fat,
    difat,
    table,
    difatStart,
    fatStart,
    dirStart,
    miniFatStart,
    miniStart,
    starts,
    total: difat + fat + content,
  }
}

/** The header ([MS-CFB] 2.2), the DIFAT sectors and the FAT sectors. */
function writeCompoundTables(
  file: Buffer,
  plan: CompoundPlan,
  offset: (n: number) => number,
): void {
  const { version, sectorSize: S, per, fat, difat, difatStart, fatStart, table } = plan
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(file, 0)
  file.writeUInt16LE(0x003e, 0x18)
  file.writeUInt16LE(version, 0x1a)
  file.writeUInt16LE(0xfffe, 0x1c)
  file.writeUInt16LE(version === 3 ? 9 : 12, 0x1e)
  file.writeUInt16LE(6, 0x20)
  file.writeUInt32LE(version === 3 ? 0 : plan.dirSectors, 0x28)
  file.writeUInt32LE(fat, 0x2c)
  file.writeUInt32LE(plan.dirStart, 0x30)
  file.writeUInt32LE(4096, 0x38)
  file.writeUInt32LE(plan.miniFatStart, 0x3c)
  file.writeUInt32LE(plan.miniFatSectors, 0x40)
  file.writeUInt32LE(difatStart, 0x44)
  file.writeUInt32LE(difat, 0x48)
  const fatList = Array.from({ length: fat }, (_, k) => fatStart + k)
  for (let k = 0; k < 109; k++) file.writeUInt32LE(fatList[k] ?? FREESECT, 0x4c + 4 * k)
  for (let d = 0; d < difat; d++) {
    const at = offset(difatStart + d)
    for (let k = 0; k < per - 1; k++) {
      file.writeUInt32LE(fatList[109 + d * (per - 1) + k] ?? FREESECT, at + 4 * k)
    }
    file.writeUInt32LE(d === difat - 1 ? ENDOFCHAIN : difatStart + d + 1, at + S - 4)
  }
  for (const [n, entry] of table.entries()) {
    file.writeUInt32LE(entry, offset(fatStart + Math.floor(n / per)) + 4 * (n % per))
  }
}

/** The directory ([MS-CFB] 2.6): root, then the streams as a chain of right siblings. */
function writeCompoundDirectory(
  file: Buffer,
  plan: CompoundPlan,
  streams: CompoundStream[],
  entry: (id: number) => number,
): void {
  const writeEntry = (id: number, name: string, type: number, start: number, size: number) => {
    const at = entry(id)
    const nameUnits = units(name)
    for (const [k, c] of nameUnits.entries()) file.writeUInt16LE(c, at + 2 * k)
    file.writeUInt16LE(2 * (nameUnits.length + 1), at + 0x40)
    file[at + 0x42] = type
    file[at + 0x43] = 1
    file.writeUInt32LE(NOSTREAM, at + 0x44)
    file.writeUInt32LE(type === 2 && id < streams.length ? id + 1 : NOSTREAM, at + 0x48)
    file.writeUInt32LE(type === 5 && streams.length ? 1 : NOSTREAM, at + 0x4c)
    file.writeUInt32LE(start, at + 0x74)
    file.writeUInt32LE(size, at + 0x78)
  }
  for (let id = 0; id < plan.dirSectors * (plan.sectorSize / 128); id++) {
    const at = entry(id)
    file.writeUInt32LE(NOSTREAM, at + 0x44)
    file.writeUInt32LE(NOSTREAM, at + 0x48)
    file.writeUInt32LE(NOSTREAM, at + 0x4c)
  }
  const { miniStream, miniStart } = plan
  writeEntry(0, 'Root Entry', 5, miniStream.length ? miniStart : ENDOFCHAIN, miniStream.length)
  for (const [i, s] of streams.entries()) {
    writeEntry(i + 1, s.name, 2, plan.starts[i] ?? defined(plan.miniStarts[i]), s.data.length)
  }
}

/** The big streams in their sectors, the mini FAT ([MS-CFB] 2.4) and the mini stream. */
function writeCompoundData(
  file: Buffer,
  plan: CompoundPlan,
  streams: CompoundStream[],
  offset: (n: number) => number,
): void {
  const { big, miniStarts, per } = plan
  for (const [i, s] of streams.entries()) {
    if (big[i]) Buffer.from(s.data).copy(file, offset(plan.starts[i] as number))
  }
  const miniTable = new Array<number>(plan.miniFatSectors * per).fill(FREESECT)
  for (const [i, s] of streams.entries()) {
    if (big[i] || !s.data.length) continue
    const n = Math.ceil(s.data.length / 64)
    const start = defined(miniStarts[i])
    for (let k = 0; k < n; k++) {
      miniTable[start + k] = k === n - 1 ? ENDOFCHAIN : start + k + 1
    }
  }
  for (const [m, entry] of miniTable.entries()) {
    const at = offset(plan.miniFatStart + Math.floor(m / per)) + 4 * (m % per)
    file.writeUInt32LE(entry, at)
  }
  if (plan.miniSectors) plan.miniStream.copy(file, offset(plan.miniStart))
}

/** A compound file with the streams under its root; streams below 4096 bytes in the mini stream. */
export function compoundFile(streams: CompoundStream[], options: CompoundOptions = {}): Buffer {
  const plan = planCompound(streams, options)
  const { sectorSize: S, per, dirStart, fatStart } = plan
  const file = Buffer.alloc(S + plan.total * S)
  const offset = (n: number) => (n + 1) * S
  const entry = (id: number) =>
    offset(dirStart + Math.floor(id / (S / 128))) + (id % (S / 128)) * 128
  writeCompoundTables(file, plan, offset)
  writeCompoundDirectory(file, plan, streams, entry)
  writeCompoundData(file, plan, streams, offset)
  options.patch?.(file, {
    sectorSize: S,
    offset,
    fatEntry: (n) => offset(fatStart + Math.floor(n / per)) + 4 * (n % per),
    entry,
    starts: plan.starts,
  })
  return file
}

/** An .xls file: the Workbook stream of the sheets in a compound file. */
export function xls(
  sheets: XlsSheet[],
  options: WorkbookStreamOptions & CompoundOptions = {},
): Uint8Array {
  return new Uint8Array(
    compoundFile([{ name: 'Workbook', data: workbookStream(sheets, options) }], options),
  )
}
