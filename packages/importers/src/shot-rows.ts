// Shot rows of the ShotView layout, read by the ShotView CSV and workbook parsers and by other
// workbook layouts of the same shape.
import type { ChronoShot } from '@openreloading/schema'
import { parseNumber } from './text.ts'
import { parseVelocity, type VelocityUnit } from './units.ts'

/** A bore flag cell is set unless it is empty, `0`, `no`, `false` or `n` (any case). */
const isSet = (cell = '') => !['', '0', 'no', 'false', 'n'].includes(cell.trim().toLowerCase())

/**
 * Shot rows after a header row, until the first row for which `footerStarts` holds; that row and
 * the non-empty rows after it are the footer. Velocity in column 2, CLEAN BORE and COLD BORE by
 * position (columns 7 and 8), read by `isSet`.
 */
export function readShotRows(
  rows: string[][],
  unitText: string | undefined,
  unit: VelocityUnit,
  footerStarts: (cells: string[]) => boolean,
): { shots: ChronoShot[]; values: number[]; flags: string[]; footer: string[][] } {
  const shots: ChronoShot[] = []
  const values: number[] = []
  const flags: string[] = []
  const footer: string[][] = []
  for (const cells of rows) {
    if (footer.length > 0 || footerStarts(cells)) {
      if (cells.length > 0) footer.push(cells)
      continue
    }
    if (!/^\d+$/.test(cells[0] ?? '')) continue
    const shot: ChronoShot = { velocity: parseVelocity(cells[1] ?? '', unitText, unit) }
    values.push(parseNumber(cells[1]))
    const which = [isSet(cells[6]) ? 'clean bore' : '', isSet(cells[7]) ? 'cold bore' : '']
      .filter(Boolean)
      .join(' and ')
    if (which) {
      shot.coldBore = true
      flags.push(`shot ${cells[0]} ${which}`)
    }
    shots.push(shot)
  }
  return { shots, values, flags, footer }
}

/** In a workbook the shots end at the first row whose first cell is neither empty nor a whole number. */
export const workbookFooterStarts = (cells: string[]) =>
  (cells[0] ?? '') !== '' && !/^\d+$/.test(cells[0])
