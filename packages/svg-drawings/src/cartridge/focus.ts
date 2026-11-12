import type { Side } from './figures.ts'

/** The id of a values table row: letters, digits and hyphens. */
export const rowId = (spec: string, side: Side, symbol: string, variant?: string) =>
  [spec, side, symbol, variant]
    .filter((x) => x !== undefined)
    .join('-')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
