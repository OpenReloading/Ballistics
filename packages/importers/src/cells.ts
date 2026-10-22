// Workbook types and the cell placement shared by the workbook readers.
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
export const clean = (text: string) => text.replaceAll('﻿', '').trim()

/**
 * Places `text` at `column` (from 1) after the row's cells, gaps as empty text, counting the
 * budgets; refuses a column beyond IV or not after the previous cell. `name` names the cell, built
 * only for a refusal.
 */
export function placeCell(
  cells: string[],
  column: number,
  text: string,
  name: () => string,
  remaining: CellBudget,
): void {
  if (column > maxColumn) throw new Error(`cell ${name()} lies beyond column IV`)
  if (column <= cells.length) throw new Error(`cell ${name()} is out of column order`)
  remaining.cells -= column - cells.length
  remaining.characters -= text.length
  if (remaining.cells < 0) throw new Error(`the worksheets hold more than ${maxCells} cells`)
  if (remaining.characters < 0) {
    throw new Error(`the worksheets hold more than ${maxCellCharacters} characters of cell text`)
  }
  while (cells.length < column - 1) cells.push('')
  cells.push(text)
}
