import { expect, it } from 'vitest'
import { type ChronoFormatId, chronoFormats, type WorkbookFormatId } from '../src/index.ts'

it('gives each entry of chronoFormats its own id', () => {
  const ids = chronoFormats.map((f) => f.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it('has an entry for each id of ChronoFormatId and WorkbookFormatId, and no other', () => {
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
