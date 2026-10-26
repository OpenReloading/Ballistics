// Statistics rows printed by the devices, compared with the shots read.

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
 * Warns per printed statistics row (see `compareStatistics`) that is not a number or differs
 * from the shots, each warning starting with `prefix`, and `<notFound> not found` when no row is
 * found; no warning without values.
 */
export function warnStatistics(
  rows: string[][],
  values: number[],
  rowLabels: [string[], string[], string[]],
  readNumber: (cell: string) => number,
  warnings: string[],
  prefix: string,
  notFound: string,
): void {
  if (values.length === 0) return
  const checks = compareStatistics(rows, values, rowLabels, readNumber)
  for (const { row, computed, withinTolerance, unreadable } of checks) {
    if (unreadable) {
      warnings.push(`${prefix}${row[0]} "${row[1] ?? ''}" is not a number; not checked`)
    } else if (!withinTolerance) {
      warnings.push(
        `${prefix}${row[0]} "${row[1]}" differs from ${computed.toFixed(1)} computed from the shots`,
      )
    }
  }
  if (checks.length === 0) warnings.push(`${notFound} not found; not checked`)
}
