/// <reference types="node" />
import { crc32, deflateRawSync } from 'node:zlib'

// Test archives written with node:zlib and DataView, independent of the reader under test.
// Layout: PKWARE APPNOTE.TXT 6.3.10, sections 4.3.7, 4.3.9, 4.3.12 and 4.3.16.

export interface Part {
  name: string
  data: string | Uint8Array
  /** 0 stored, 8 deflate (default), any other value is written as given with the stored bytes. */
  method?: number
  flags?: number
  /** Declared uncompressed size; default the real size. */
  size?: number
  crc?: number
  /** Compressed bytes to write instead of the real ones. */
  compressed?: Uint8Array
  /** Flag bit 3: zero CRC and sizes in the local header, a data descriptor (4.3.9) after the data. */
  descriptor?: boolean
}

interface ZipOptions {
  comment?: string
  /** Fields of the end of central directory record to overwrite, by byte offset in the record. */
  end?: Record<number, number>
}

/** The local entry (header, name, data, descriptor) and central entry (header, name) of a part. */
function zipPart(
  part: Part,
  offset: number,
): { local: Buffer[]; central: Buffer[]; length: number } {
  const data = typeof part.data === 'string' ? Buffer.from(part.data, 'utf8') : part.data
  const method = part.method ?? 8
  const compressed = part.compressed ?? (method === 8 ? deflateRawSync(data) : data)
  const name = Buffer.from(part.name, 'utf8')
  const crc = part.crc ?? crc32(data)
  const size = part.size ?? data.length
  const flags = (part.flags ?? 0) | (part.descriptor ? 8 : 0)
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4)
  head.writeUInt16LE(flags, 6)
  head.writeUInt16LE(method, 8)
  if (!part.descriptor) {
    head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(compressed.length, 18)
    head.writeUInt32LE(size, 22)
  }
  head.writeUInt16LE(name.length, 26)
  const descriptor = Buffer.alloc(part.descriptor ? 16 : 0)
  if (part.descriptor) {
    descriptor.writeUInt32LE(0x08074b50, 0)
    descriptor.writeUInt32LE(crc, 4)
    descriptor.writeUInt32LE(compressed.length, 8)
    descriptor.writeUInt32LE(size, 12)
  }
  const entry = Buffer.alloc(46)
  entry.writeUInt32LE(0x02014b50, 0)
  entry.writeUInt16LE(20, 4)
  entry.writeUInt16LE(20, 6)
  entry.writeUInt16LE(flags, 8)
  entry.writeUInt16LE(method, 10)
  entry.writeUInt32LE(crc, 16)
  entry.writeUInt32LE(compressed.length, 20)
  entry.writeUInt32LE(size, 24)
  entry.writeUInt16LE(name.length, 28)
  entry.writeUInt32LE(offset, 42)
  return {
    local: [head, name, Buffer.from(compressed), descriptor],
    central: [entry, name],
    length: head.length + name.length + compressed.length + descriptor.length,
  }
}

/** The end of central directory record; `overrides` are written over its fields. */
function endRecord(
  count: number,
  directoryLength: number,
  offset: number,
  commentLength: number,
  overrides: Record<number, number>,
): Buffer {
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(directoryLength, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(commentLength, 20)
  for (const [at, value] of Object.entries(overrides)) {
    if (Number(at) >= 12) end.writeUInt32LE(value, Number(at))
    else end.writeUInt16LE(value, Number(at))
  }
  return end
}

/** A ZIP archive of the parts, in order. */
export function zip(parts: Part[], options: ZipOptions = {}): Uint8Array {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const part of parts) {
    const written = zipPart(part, offset)
    local.push(...written.local)
    central.push(...written.central)
    offset += written.length
  }
  const directory = Buffer.concat(central)
  const comment = Buffer.from(options.comment ?? '', 'latin1')
  const end = endRecord(parts.length, directory.length, offset, comment.length, options.end ?? {})
  return new Uint8Array(Buffer.concat([...local, directory, end, comment]))
}

const xmlText = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const officeRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships'

/** Column letters for a column number from 1 (bijective base 26). */
function letters(column: number): string {
  let s = ''
  for (let c = column; c > 0; c = Math.floor((c - 1) / 26)) {
    s = String.fromCharCode(65 + ((c - 1) % 26)) + s
  }
  return s
}

/** Worksheet XML with every non-empty cell a shared string from `strings`, placed by reference. */
function sheetXml(rows: string[][], strings: string[]): string {
  const xml = rows.map((cells, r) => {
    const cs = cells.flatMap((text, c) => {
      if (!text) return []
      let k = strings.indexOf(text)
      if (k < 0) k = strings.push(text) - 1
      return [`<c r="${letters(c + 1)}${r + 1}" t="s"><v>${k}</v></c>`]
    })
    return `<row r="${r + 1}">${cs.join('')}</row>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${main}"><sheetData>${xml.join('')}</sheetData></worksheet>`
}

/** The parts of a workbook with one worksheet per entry; `sheets[i].xml` replaces the generated XML. */
export function workbookParts(sheets: { name: string; rows?: string[][]; xml?: string }[]): Part[] {
  const strings: string[] = []
  const sheetParts = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    data: s.xml ?? sheetXml(s.rows ?? [], strings),
  }))
  const sst = strings.map((s) => `<si><t xml:space="preserve">${xmlText(s)}</t></si>`).join('')
  const rels = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${officeRel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')
  const list = sheets
    .map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')
  return [
    { name: '[Content_Types].xml', data: '<Types/>' },
    {
      name: '_rels/.rels',
      data: `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<workbook xmlns="${main}" xmlns:r="${officeRel}"><sheets>${list}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<Relationships xmlns="${packageRel}">${rels}<Relationship Id="rIdS" Type="${officeRel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    },
    { name: 'xl/sharedStrings.xml', data: `<sst xmlns="${main}">${sst}</sst>` },
    ...sheetParts,
  ]
}

/** An XLSX workbook archive; `method` applies to every part. */
export function xlsx(
  sheets: { name: string; rows?: string[][]; xml?: string }[],
  method = 8,
): Uint8Array {
  return zip(workbookParts(sheets).map((p) => ({ ...p, method })))
}
