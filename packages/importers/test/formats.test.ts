import { expect, it } from 'vitest'
import { type ChronoFormatId, chronoFormats, type WorkbookFormatId } from '../src/index.ts'

it('has one entry for each id of ChronoFormatId and WorkbookFormatId, and no other', () => {
  // a Record of the union needs every member and refuses any other: the type check ties these keys to it
  const chrono: Record<ChronoFormatId, true> = {
    'openreloading-json': true,
    'shotview-csv': true,
    'shotview-xlsx': true,
    'openreloading-csv': true,
    delimited: true,
  }
  const workbook: Record<WorkbookFormatId, true> = { 'shotview-xlsx': true }
  expect(chronoFormats.map((f) => f.id).sort()).toEqual(Object.keys(chrono).sort())
  expect(chronoFormats.filter((f) => f.reads === 'workbook').map((f) => f.id)).toEqual(
    Object.keys(workbook),
  )
})
