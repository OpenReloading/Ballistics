// Workbook types and the cell placement shared by the workbook readers.
import { refuseFile } from './diagnostics.ts'
import { maxCellCharacters, maxCells, maxColumn } from './limits.ts'

/** Name and rows of cell text of one worksheet; no styles, formats or formulas applied. */
export interface Worksheet {
  name: string
  /** Rows in document order; cells placed by their reference, gaps as empty text. */
  rows: string[][]
}

/** The worksheets of an XLSX or legacy XLS file, in file order. */
export interface Workbook {
  worksheets: Worksheet[]
}

/** Cells (gaps included) and characters of cell text every worksheet of a workbook may still produce. */
export interface CellBudget {
  cells: number
  characters: number
}

/** Cell text trimmed and U+FEFF removed. */
export const clean = (text: string): string => text.replaceAll('﻿', '').trim()

/** A cell to place: its column (from 1), its text, and its name, built only for a refusal. */
export interface PlacedCell {
  column: number
  text: string
  name: () => string
}

/**
 * Places the cell's text at its column after the row's cells, gaps as empty text, counting the
 * budgets; refuses a column beyond IV or not after the previous cell.
 */
export function placeCell(
  cells: string[],
  { column, text, name }: PlacedCell,
  remaining: CellBudget,
): void {
  if (column > maxColumn) refuseFile('cellBeyondColumnIV', { cell: name() })
  if (column <= cells.length) refuseFile('cellOutOfOrder', { cell: name() })
  remaining.cells -= column - cells.length
  remaining.characters -= text.length
  if (remaining.cells < 0) refuseFile('tooManyCells', { max: maxCells })
  if (remaining.characters < 0) refuseFile('tooMuchCellText', { max: maxCellCharacters })
  while (cells.length < column - 1) cells.push('')
  cells.push(text)
}
