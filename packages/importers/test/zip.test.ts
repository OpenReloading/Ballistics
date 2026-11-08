/// <reference types="node" />
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../src/workbook.ts'
import { rejection } from './refusal.ts'
import { type Part, workbookParts, xlsx, zip } from './xlsx.ts'

const rows = [['Test load'], ['#', 'Speed (FPS)'], ['1', '2800.0']]
const sheet = 'xl/worksheets/sheet1.xml'
const parts = workbookParts([{ name: 'S1', rows }])
/** The workbook parts with the worksheet entry changed. */
const withSheet = (change: Partial<Part>, more: Part[] = []) =>
  zip([...parts.map((p) => (p.name === sheet ? { ...p, ...change } : p)), ...more])

/** Node's raw inflate as the function the reader takes. */
const inflate = async (data: Uint8Array<ArrayBuffer>) => new Uint8Array(inflateRawSync(data))

describe('ZIP container: archives, comments and inflate functions', () => {
  it('reads stored and deflated archives to the same worksheets', async () => {
    const deflated = await readWorkbook(xlsx([{ name: 'S1', rows }]))
    expect(await readWorkbook(xlsx([{ name: 'S1', rows }], 0))).toEqual(deflated)
    expect(deflated).toEqual({ worksheets: [{ name: 'S1', rows }] })
  })

  it('finds the end record behind a comment that holds its signature', async () => {
    const book = zip(parts, { comment: 'PK\x05\x06 not the record' })
    expect((await readWorkbook(book)).worksheets[0]?.rows).toEqual(rows)
  })

  it('takes an inflate function', async () => {
    expect((await readWorkbook(xlsx([{ name: 'S1', rows }]), { inflate })).worksheets).toHaveLength(
      1,
    )
  })

  it('never inflates parts it does not need', async () => {
    const image = { name: 'xl/media/image1.png', data: 'png', method: 99 }
    expect((await readWorkbook(withSheet({}, [image]))).worksheets[0]?.rows).toEqual(rows)
  })

  it('refuses bytes that are not an archive', async () => {
    expect(await rejection(readWorkbook(new TextEncoder().encode('#,Speed (FPS)\n1,2800\n')))).toEqual(
      { code: 'zipNoEnd', params: {} },
    )
  })

  it('refuses split and ZIP64 archives', async () => {
    expect(await rejection(readWorkbook(zip(parts, { end: { 4: 1 } })))).toEqual({
      code: 'zipSplit',
      params: {},
    })
    expect(await rejection(readWorkbook(zip(parts, { end: { 10: 0xffff } })))).toEqual({
      code: 'zip64',
      params: {},
    })
  })
})

describe('ZIP container: data descriptors and refused entries', () => {
  it('reads entries with a data descriptor, stored and deflated', async () => {
    for (const method of [0, 8]) {
      const book = zip(parts.map((p) => ({ ...p, method, descriptor: true })))
      expect((await readWorkbook(book)).worksheets[0]?.rows).toEqual(rows)
    }
  })

  it('refuses encrypted entries, other methods and repeated names', async () => {
    expect(await rejection(readWorkbook(withSheet({ flags: 1 })))).toEqual({
      code: 'partEncrypted',
      params: { part: sheet },
    })
    expect(await rejection(readWorkbook(withSheet({ method: 99 })))).toEqual({
      code: 'partMethod',
      params: { method: 99, part: sheet },
    })
    const twin = { name: 'XL/worksheets/sheet1.xml', data: '<x/>' }
    expect(await rejection(readWorkbook(withSheet({}, [twin])))).toEqual({
      code: 'partsDifferInCase',
      params: { name: 'XL/worksheets/sheet1.xml', other: sheet },
    })
    const copy = { name: sheet, data: '<x/>' }
    expect(await rejection(readWorkbook(withSheet({}, [copy])))).toEqual({
      code: 'partTwice',
      params: { name: sheet },
    })
  })

  it('refuses entry data outside the file', async () => {
    const book = withSheet({ method: 0 })
    // the central directory holds the last copy of the name; declare sizes past the file end
    const entry = Buffer.from(book).lastIndexOf(sheet) - 46
    const view = new DataView(book.buffer)
    view.setUint32(entry + 20, 1000000, true)
    view.setUint32(entry + 24, 1000000, true)
    expect(await rejection(readWorkbook(book))).toEqual({
      code: 'partDataOutside',
      params: { part: sheet },
    })
  })

  it('refuses a changed byte through the CRC-32', async () => {
    const book = withSheet({ method: 0 })
    const at = Buffer.from(book).indexOf('<row r="3"')
    book[at + 8] = '4'.charCodeAt(0)
    expect(await rejection(readWorkbook(book))).toEqual({ code: 'partCrc', params: { part: sheet } })
  })
})

describe('ZIP size limits', () => {
  it('refuses a part that declares more than 8 MiB before inflating', async () => {
    expect(await rejection(readWorkbook(withSheet({ size: 9437184 })))).toEqual({
      code: 'partTooLarge',
      params: { size: 9437184, limit: 8388608, part: sheet },
    })
  })

  it('refuses compressed data far larger than the declared size before inflating', async () => {
    const compressed = new Uint8Array(200_000)
    expect(await rejection(readWorkbook(withSheet({ size: 1000, compressed })))).toEqual({
      code: 'partCompressedTooLarge',
      params: { compressed: 200000, size: 1000, part: sheet },
    })
  })

  it('refuses parts that declare more than 32 MiB together', async () => {
    const sheets = Array.from({ length: 5 }, (_, i) => ({ name: `S${i + 1}`, rows }))
    const big = workbookParts(sheets).map((p) =>
      p.name.startsWith('xl/worksheets/') ? { ...p, size: 7 * 1024 * 1024 } : p,
    )
    expect(await rejection(readWorkbook(zip(big)))).toEqual({
      code: 'partsTooLarge',
      params: { max: 33554432 },
    })
  })

  it('stops inflating past the declared size and refuses short output', async () => {
    const bomb = deflateRawSync(Buffer.alloc(1 << 20, 0x20))
    expect(await rejection(readWorkbook(withSheet({ size: 100, compressed: bomb })))).toEqual({
      code: 'partInflatesMore',
      params: { size: 100, part: sheet },
    })
    expect(await rejection(readWorkbook(withSheet({ size: 100000 })))).toMatchObject({
      code: 'partInflatesLess',
      params: { size: 100000, part: sheet },
    })
  })

  it('refuses truncated deflate data', async () => {
    const data = parts.find((p) => p.name === sheet)?.data as string
    const deflated = deflateRawSync(Buffer.from(data))
    expect(
      await rejection(
        readWorkbook(withSheet({ compressed: deflated.subarray(0, deflated.length - 4) })),
      ),
    ).toEqual({ code: 'partCorrupt', params: { part: sheet } })
  })
})
