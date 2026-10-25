// Compound files ([MS-CFB] Compound File Binary File Format, revision 12.0,
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b;
// section numbers below refer to it), read only as far as the streams under the root storage.
// Every loop is bounded by the file's sector count, and no buffer is sized from a declared value
// before that value has been checked against a limit.

// sector numbers above REGSECT 0xFFFFFFF9 are markers (2.1)
const lastRegular = 0xfffffff9
const noStream = 0xffffffff

const fail = (cause: string): never => {
  throw new Error(`not an XLS workbook: ${cause}`)
}

// assumed bound, not a cited one: a workbook's root storage holds a few entries
const maxRootEntries = 65536

/** Header values and sector access of a compound file. */
interface CompoundFile {
  bytes: Uint8Array
  version: number
  /** Sector size in bytes. */
  size: number
  /** 4-byte entries per sector. */
  per: number
  /** Sectors that start inside the file. */
  sectors: number
  /** `at`, after checking that `n` bytes from it lie inside the file. */
  within(at: number, n: number): number
  u16(at: number): number
  u32(at: number): number
  /** Byte position of sector `n`; throws unless it starts inside the file. */
  offset(n: number): number
}

/** The header (2.2): byte order, version 3 or 4 with its sector size, standard mini stream layout. */
function readHeader(bytes: Uint8Array): CompoundFile {
  if (bytes.length < 512) fail('the file is shorter than its 512-byte header')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // the last sector may be short (2.3), so every read is checked against the file length
  const within = (at: number, n: number) => {
    if (at + n > bytes.length) fail(`the file ends before byte ${at + n}`)
    return at
  }
  const u16 = (at: number) => view.getUint16(within(at, 2), true)
  const u32 = (at: number) => view.getUint32(within(at, 4), true)
  if (u16(0x1c) !== 0xfffe) fail('byte order mark is not FFFE')
  const version = u16(0x1a)
  const shift = u16(0x1e)
  if (!((version === 3 && shift === 9) || (version === 4 && shift === 12))) {
    fail(`version ${version} with sector shift ${shift} is not read`)
  }
  if (u16(0x20) !== 6 || u32(0x38) !== 4096) fail('mini stream layout is not the standard one')
  const size = 1 << shift
  // sector n starts at (n + 1) * size (2.3) and must start inside the file
  const sectors = Math.ceil(bytes.length / size) - 1
  const offset = (n: number) => {
    if (n >= sectors) fail(`sector ${n} lies outside the file`)
    return (n + 1) * size
  }
  return { bytes, version, size, per: size / 4, sectors, within, u16, u32, offset }
}

/** The FAT sectors: 109 in the header, then the DIFAT chain (2.5); each must lie in the file. */
function buildFat(file: CompoundFile): number[] {
  const { u32, offset, size, per } = file
  const fatCount = u32(0x2c)
  const fat: number[] = []
  const listed = () => fail(`the FAT lists ${fat.length} of ${fatCount} sectors`)
  if (fatCount > file.sectors) listed()
  for (let k = 0; k < 109 && fat.length < fatCount; k++) fat.push(u32(0x4c + 4 * k))
  const difatSeen = new Set<number>()
  for (let d = u32(0x44), k = 0; fat.length < fatCount && k < u32(0x48); k++) {
    if (d > lastRegular) break
    if (difatSeen.has(d)) fail(`sector chain loops at sector ${d}`)
    difatSeen.add(d)
    const at = offset(d)
    for (let j = 0; j < per - 1 && fat.length < fatCount; j++) fat.push(u32(at + 4 * j))
    d = u32(at + size - 4)
  }
  if (fat.length < fatCount) listed()
  for (const n of fat) offset(n)
  return fat
}

/**
 * The next sector of `n` from the table (FAT or mini FAT) held in the sectors `table`, read in
 * place (2.3); `what` names a sector and `tableName` the table in refusals.
 */
function tableNext(
  file: CompoundFile,
  table: number[],
  what: string,
  tableName: string,
): (n: number) => number {
  return (n) => {
    const s = table[Math.floor(n / file.per)]
    if (s === undefined) fail(`${what} ${n} has no ${tableName} entry`)
    return file.u32(file.offset(s) + 4 * (n % file.per))
  }
}

/**
 * The sectors of a chain from `start`: `count` sectors, or up to its end when undefined; loops
 * and early ends are refused, and with `inFile` each sector must lie in the file.
 */
function readChain(
  file: CompoundFile,
  start: number,
  count: number | undefined,
  step: (n: number) => number,
  inFile: boolean,
): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (let n = start; count === undefined ? n <= lastRegular : out.length < count; n = step(n)) {
    if (n > lastRegular) fail('sector chain ends before the stream does')
    if (seen.has(n)) fail(`sector chain loops at sector ${n}`)
    seen.add(n)
    if (inFile) file.offset(n)
    out.push(n)
  }
  return out
}

/**
 * A reader of the stream `name` that starts at sector `start` and declares `declared` bytes;
 * streams under 4096 bytes lie in the mini stream of the root entry at `root`. The reader refuses
 * a stream that declares more than its `limit`.
 */
function streamReader(
  file: CompoundFile,
  next: (n: number) => number,
  root: number,
  name: string,
  start: number,
  declared: number,
): (limit: number) => Uint8Array {
  const { bytes, size, u32, offset } = file
  return (limit) => {
    if (declared > limit) fail(`the ${name} stream holds ${declared} bytes; the limit is ${limit}`)
    const out = new Uint8Array(declared)
    const copy = (from: number, length: number, to: number) => {
      if (from + length > bytes.length) fail(`the ${name} stream runs past the end of the file`)
      out.set(bytes.subarray(from, from + length), to)
    }
    if (declared >= 4096) {
      readChain(file, start, Math.ceil(declared / size), next, true).forEach((n, k) => {
        copy(offset(n), Math.min(size, declared - k * size), k * size)
      })
      return out
    }
    if (declared === 0) return out
    // mini stream (2.4): 64-byte mini sectors in the root entry's chain
    const miniFatStart = u32(0x3c)
    const rootStart = u32(root + 0x74)
    if (miniFatStart > lastRegular || rootStart > lastRegular) fail('the mini stream is missing')
    const miniFat = readChain(file, miniFatStart, undefined, next, true)
    const rootChain = readChain(file, rootStart, undefined, next, true)
    const miniLength = Math.min(u32(root + 0x78), rootChain.length * size)
    const miniNext = tableNext(file, miniFat, 'mini sector', 'mini FAT')
    readChain(file, start, Math.ceil(declared / 64), miniNext, false).forEach((m, k) => {
      if ((m + 1) * 64 > miniLength) fail(`mini sector ${m} lies outside the mini stream`)
      const from = offset(rootChain[Math.floor((m * 64) / size)]) + ((m * 64) % size)
      copy(from, Math.min(64, declared - k * 64), k * 64)
    })
    return out
  }
}

/** The name of the directory entry at `at`. */
function entryName(file: CompoundFile, at: number): string {
  // the name length counts bytes with the terminating NUL; at most 32 UTF-16 code units
  const units = Math.floor(Math.min(file.u16(at + 0x40), 64) / 2) - 1
  let name = ''
  for (let k = 0; k < units; k++) name += String.fromCharCode(file.u16(at + 2 * k))
  return name
}

/** The declared stream size of the directory entry at `at`. */
function entrySize(file: CompoundFile, at: number): number {
  // version 3 ignores the high 32 bits of the size (2.6.1)
  return file.u32(at + 0x78) + (file.version === 4 ? file.u32(at + 0x7c) * 2 ** 32 : 0)
}

/**
 * The directory (2.6, 128-byte entries in the directory chain): a reader for each stream named in
 * `wanted` among the children of the root storage.
 */
function readDirectory(
  file: CompoundFile,
  next: (n: number) => number,
  wanted: readonly string[],
): Map<string, (limit: number) => Uint8Array> {
  const { bytes, size, within, u32, offset } = file
  const directory = readChain(file, u32(0x30), undefined, next, true)
  const perSector = size / 128
  const entries = directory.length * perSector
  const entry = (id: number) =>
    within(offset(directory[Math.floor(id / perSector)]) + (id % perSector) * 128, 128)
  if (entries === 0 || bytes[entry(0) + 0x42] !== 5) fail('the directory has no root entry')
  const root = entry(0)
  const streams = new Map<string, (limit: number) => Uint8Array>()
  // the root's children form a binary tree of siblings (2.6.4); visited without recursion
  const stack = [u32(root + 0x4c)]
  const visited = new Set<number>()
  while (stack.length > 0) {
    const id = stack.pop() as number
    if (id === noStream) continue
    if (id >= entries || visited.has(id)) fail(`directory entry ${id} is out of range or repeated`)
    visited.add(id)
    if (visited.size > maxRootEntries) {
      fail(`the root storage holds more than ${maxRootEntries} entries`)
    }
    const at = entry(id)
    stack.push(u32(at + 0x44), u32(at + 0x48))
    if (bytes[at + 0x42] !== 2) continue
    const name = entryName(file, at)
    if (!wanted.includes(name.toUpperCase())) continue
    const start = u32(at + 0x74)
    streams.set(
      name.toUpperCase(),
      streamReader(file, next, root, name, start, entrySize(file, at)),
    )
  }
  return streams
}

/**
 * The streams named in `wanted` (upper case) directly under the root storage of a compound file;
 * each call reads the stream's bytes and refuses a stream that declares more than `limit` bytes.
 */
export function compoundStreams(
  bytes: Uint8Array,
  wanted: readonly string[],
): Map<string, (limit: number) => Uint8Array> {
  const file = readHeader(bytes)
  const fat = buildFat(file)
  return readDirectory(file, tableNext(file, fat, 'sector', 'FAT'), wanted)
}
