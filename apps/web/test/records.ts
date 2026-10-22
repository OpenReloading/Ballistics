import { sheetId } from '@openreloading/schema'
import type { CartridgeDetail } from '../src/lib/api-types.ts'
import { readRecord } from './read-record.ts'

/** A cartridge record file as stored (provenance as a reference), by cartridge id. */
export const cartridgeRecord = (id: string) => readRecord<CartridgeDetail>(`cartridges/${id}.json`)

/** The record of a C.I.P. sheet id (`cip-<id>-<date>`, as figure ids and golden files name it). */
export function sheetRecord(sheet: string) {
  const c = cartridgeRecord(sheet.replace(/^cip-/, '').replace(/-\d{4}-\d{2}-\d{2}$/, ''))
  if (sheetId(c) !== sheet) throw new Error(`${c.id} is sheet ${sheetId(c)}, not ${sheet}`)
  return c
}
