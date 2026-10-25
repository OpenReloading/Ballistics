/// <reference types="node" />
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readWorkbook } from '../src/workbook.ts'
import { type Part, workbookParts, xlsx, zip } from './xlsx.ts'

const rows = [['Test load'], ['#', 'Speed (FPS)'], ['1', '2800.0']]
const sheet = 'xl/worksheets/sheet1.xml'
const parts = workbookParts([{ name: 'S1', rows }])
/** The workbook parts with the worksheet entry changed. */
const withSheet = (change: Partial<Part>, more: Part[] = []) =>
  zip([...parts.map((p) => (p.name === sheet ? { ...p, ...change } : p)), ...more])

describe('ZIP container', () => {
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
    const inflate = async (data: Uint8Array<ArrayBuffer>) => new Uint8Array(inflateRawSync(data))
    expect((await readWorkbook(xlsx([{ name: 'S1', rows }]), { inflate })).worksheets).toHaveLength(
      1,
    )
  })

  it('never inflates parts it does not need', async () => {
    const image = { name: 'xl/media/image1.png', data: 'png', method: 99 }
    expect((await readWorkbook(withSheet({}, [image]))).worksheets[0]?.rows).toEqual(rows)
  })

  it('refuses bytes that are not an archive', async () => {
    await expect(readWorkbook(new TextEncoder().encode('#,Speed (FPS)\n1,2800\n'))).rejects.toThrow(
      'not an XLSX workbook: no ZIP end of central directory record',
    )
  })

  it('refuses split and ZIP64 archives', async () => {
    await expect(readWorkbook(zip(parts, { end: { 4: 1 } }))).rejects.toThrow(
      'split archives are not read',
    )
    await expect(readWorkbook(zip(parts, { end: { 10: 0xffff } }))).rejects.toThrow(
      'ZIP64 archives are not read',
    )
  })

  it('reads entries with a data descriptor, stored and deflated', async () => {
    for (const method of [0, 8]) {
      const book = zip(parts.map((p) => ({ ...p, method, descriptor: true })))
      expect((await readWorkbook(book)).worksheets[0]?.rows).toEqual(rows)
    }
  })

  it('refuses encrypted entries, other methods and repeated names', async () => {
    await expect(readWorkbook(withSheet({ flags: 1 }))).rejects.toThrow(
      `XLSX part ${sheet}: encrypted entries are not read`,
    )
    await expect(readWorkbook(withSheet({ method: 99 }))).rejects.toThrow(
      `XLSX part ${sheet}: compression method 99 is not read`,
    )
    const twin = { name: 'XL/worksheets/sheet1.xml', data: '<x/>' }
    await expect(readWorkbook(withSheet({}, [twin]))).rejects.toThrow(
      `XLSX parts ${sheet} and XL/worksheets/sheet1.xml differ only in case`,
    )
    const copy = { name: sheet, data: '<x/>' }
    await expect(readWorkbook(withSheet({}, [copy]))).rejects.toThrow(
      `XLSX part ${sheet} appears twice`,
    )
  })

  it('refuses entry data outside the file', async () => {
    const book = withSheet({ method: 0 })
    // the central directory holds the last copy of the name; declare sizes past the file end
    const entry = Buffer.from(book).lastIndexOf(sheet) - 46
    const view = new DataView(book.buffer)
    view.setUint32(entry + 20, 1000000, true)
    view.setUint32(entry + 24, 1000000, true)
    await expect(readWorkbook(book)).rejects.toThrow(
      `XLSX part ${sheet}: data lies outside the file`,
    )
  })

  it('refuses a changed byte through the CRC-32', async () => {
    const book = withSheet({ method: 0 })
    const at = Buffer.from(book).indexOf('<row r="3"')
    book[at + 8] = '4'.charCodeAt(0)
    await expect(readWorkbook(book)).rejects.toThrow(`XLSX part ${sheet}: CRC-32 mismatch`)
  })
})

describe('ZIP size limits', () => {
  it('refuses a part that declares more than 8 MiB before inflating', async () => {
    await expect(readWorkbook(withSheet({ size: 9437184 }))).rejects.toThrow(
      `XLSX part ${sheet}: declares 9437184 bytes; the limit is 8388608`,
    )
  })

  it('refuses compressed data far larger than the declared size before inflating', async () => {
    const compressed = new Uint8Array(200_000)
    await expect(readWorkbook(withSheet({ size: 1000, compressed }))).rejects.toThrow(
      `XLSX part ${sheet}: compressed size 200000 is more than 1000 bytes can take`,
    )
  })

  it('refuses parts that declare more than 32 MiB together', async () => {
    const sheets = Array.from({ length: 5 }, (_, i) => ({ name: `S${i + 1}`, rows }))
    const big = workbookParts(sheets).map((p) =>
      p.name.startsWith('xl/worksheets/') ? { ...p, size: 7 * 1024 * 1024 } : p,
    )
    await expect(readWorkbook(zip(big))).rejects.toThrow(
      'XLSX parts declare more than 33554432 bytes in total',
    )
  })

  it('stops inflating past the declared size and refuses short output', async () => {
    const bomb = deflateRawSync(Buffer.alloc(1 << 20, 0x20))
    await expect(readWorkbook(withSheet({ size: 100, compressed: bomb }))).rejects.toThrow(
      `XLSX part ${sheet}: inflates to more than the declared 100 bytes`,
    )
    await expect(readWorkbook(withSheet({ size: 100000 }))).rejects.toThrow(
      /inflates to \d+ bytes, not the declared 100000/,
    )
  })

  it('refuses truncated deflate data', async () => {
    const data = parts.find((p) => p.name === sheet)?.data as string
    const deflated = deflateRawSync(Buffer.from(data))
    await expect(
      readWorkbook(withSheet({ compressed: deflated.subarray(0, deflated.length - 4) })),
    ).rejects.toThrow(`XLSX part ${sheet}: deflate data is corrupt or truncated`)
  })
})
