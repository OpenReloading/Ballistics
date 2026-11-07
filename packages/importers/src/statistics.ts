// Statistics rows printed by the devices, compared with the shots read.
import type { ChronoDiagnostic } from './diagnostics.ts'

// printed statistics come from unrounded device values; shots are printed to 0.1
const statisticsTolerance = 0.2

/**
 * Mean, population standard deviation (divides by n, as the devices print it) and extreme
 * spread of `values`, which must not be empty.
 */
function shotStatistics(values: number[]): {
  mean: number
  standardDeviation: number
  extremeSpread: number
} {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const standardDeviation = Math.sqrt(
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length,
  )
  const extremeSpread =
    values.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY) -
    values.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY)
  return { mean, standardDeviation, extremeSpread }
}

/**
 * Mean, standard deviation and extreme spread of `values` compared with the printed values in
 * the rows labelled (upper case) `rowLabels[0]`, `rowLabels[1]` and `rowLabels[2]`, as read by
 * `readNumber`.
 */
function compareStatistics(
  rows: string[][],
  values: number[],
  rowLabels: [string[], string[], string[]],
  readNumber: (cell: string) => number,
): { row: string[]; computed: number; withinTolerance: boolean; unreadable: boolean }[] {
  const { mean, standardDeviation, extremeSpread } = shotStatistics(values)
  const compared: [number, string[]][] = [
    [mean, rowLabels[0]],
    [standardDeviation, rowLabels[1]],
    [extremeSpread, rowLabels[2]],
  ]
  return compared.flatMap(([computed, labels]) => {
    const row = rows.find((cells) => labels.includes((cells[0] ?? '').toUpperCase()))
    if (!row) return []
    const printed = readNumber(row[1] ?? '')
    const unreadable = Number.isNaN(printed)
    const withinTolerance = !unreadable && Math.abs(printed - computed) <= statisticsTolerance
    return [{ row, computed, withinTolerance, unreadable }]
  })
}

/**
 * Warns per printed footer statistics row (see `compareStatistics`) that is not a number or
 * differs from the shots, each warning with the params of `at`, and once when no row is found; no
 * warning without values.
 */
export function warnStatistics(
  {
    rows,
    rowLabels,
    readNumber,
  }: {
    rows: string[][]
    rowLabels: [string[], string[], string[]]
    readNumber: (cell: string) => number
  },
  values: number[],
  { warnings, at }: { warnings: ChronoDiagnostic[]; at: { worksheet?: number } },
): void {
  if (values.length === 0) return
  const checks = compareStatistics(rows, values, rowLabels, readNumber)
  for (const { row, computed, withinTolerance, unreadable } of checks) {
    const printed = { ...at, label: row[0] ?? '', value: row[1] ?? '' }
    if (unreadable) warnings.push({ code: 'statisticNotNumber', params: printed })
    else if (!withinTolerance) {
      warnings.push({
        code: 'statisticDiffers',
        params: { ...printed, computed: computed.toFixed(1) },
      })
    }
  }
  if (checks.length === 0) warnings.push({ code: 'footerStatisticsMissing', params: at })
}
