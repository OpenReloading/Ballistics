// Size bounds of the workbook readers (columns and cells also of delimited text and JSON lists), all assumed, not cited.

// the exports use 9 columns, and a 10000-shot worksheet holds 90000 cells of about 10 characters
export const maxColumn = 256
export const maxCells = 1_000_000
export const maxCellCharacters = 32 * 1024 * 1024

// headroom for the XML of those cells: 4 elements per cell, twice the `c` and `v` of a value cell,
// and twice the cell text in characters of text and attribute markup
export const maxElements = 4 * maxCells
export const maxXmlCharacters = 2 * maxCellCharacters

// the largest needed part of the real exports is about 20 KB; the per-part limit also bounds the
// Workbook stream of a legacy XLS file
export const maxPartSize = 8 * 1024 * 1024
export const maxTotalSize = 32 * 1024 * 1024
