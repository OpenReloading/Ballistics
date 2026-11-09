import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { verify } from '../src/commands.ts'
import type { Metrics, VerifyResult } from '../src/result.ts'

// A release step: reproduces the validation page's published results on the load rows not in the repository, run when VALIDATION_ROWS names the rows file and skipped otherwise; BALLISTICS_RECORDS names the records roots, as for the command line.
const rows = process.env.VALIDATION_ROWS
const records = process.env.BALLISTICS_RECORDS?.split(':').filter(Boolean) ?? []

const page = readFileSync(
  new URL('../../../apps/docs/docs/models/validation.md', import.meta.url),
  'utf8',
)

/** The family key of each family line of the published table. */
const familyKey: Record<string, string> = {
  'double base, ball': 'double/ball',
  'double base, extruded': 'double/extruded',
  'single base, extruded': 'single/extruded',
  'base not stated, extruded': 'unspecified/extruded',
  'base and form not stated': 'unspecified/unspecified',
}

/** The body rows of the Markdown table whose header names `column`, as trimmed cells. */
function table(column: string): string[][] {
  const lines = page.split('\n')
  const start = lines.findIndex((l) => l.startsWith('|') && l.includes(column))
  const body: string[][] = []
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    body.push(
      line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )
  }
  return body
}

const count = (cell: string) => Number(cell.replaceAll(',', ''))
const percent = (cell: string) => Number(cell.replace(' %', ''))

/** Whether `fraction` rounds to the published `cell` at its printed decimals. */
function matches(fraction: number | undefined, cell: string) {
  const decimals = cell.replace(' %', '').split('.')[1]?.length ?? 0
  return Math.abs((fraction ?? Number.NaN) * 100 - percent(cell)) <= 0.5 * 10 ** -decimals + 1e-9
}

/** Compares one velocity line of the page (label, cartridges, rows, median, P90, coverage) with the run. */
function expectVelocityLine(r: VerifyResult, cells: string[]) {
  const [label = '', , used = '', median = '', p90 = '', coverage = ''] = cells
  const m: Metrics | undefined =
    label === 'All' ? r.overall : r.byFamily[familyKey[label.replace('Family ', '')] ?? '']
  expect(m?.rows.used, label).toBe(count(used))
  expect(matches(m?.velocity?.median, median), `${label} median`).toBe(true)
  expect(matches(m?.velocity?.p90, p90), `${label} P90`).toBe(true)
  expect(matches(m?.interval?.coverage, coverage), `${label} coverage`).toBe(true)
}

describe.skipIf(rows === undefined)('published validation results', () => {
  it('reproduces the velocity table and the pressure line of the validation page', async () => {
    const r = await verify({ rows: rows ?? '', records, split: 'validation', final: false })
    const velocity = table('Median velocity error').filter(
      ([label]) => label === 'All' || label?.startsWith('Family '),
    )
    expect(velocity.length).toBeGreaterThan(0)
    for (const cells of velocity) expectVelocityLine(r, cells)
    const [, pressureRows = '', median = '', p90 = ''] =
      table('Median pressure error').find(([label]) => label === 'All') ?? []
    expect(r.overall.pressure?.rows).toBe(count(pressureRows))
    expect(matches(r.overall.pressure?.median, median), 'pressure median').toBe(true)
    expect(matches(r.overall.pressure?.p90, p90), 'pressure P90').toBe(true)
  }, 600_000)
})
