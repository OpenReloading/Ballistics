import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '../../..')

/** Factors between the stored units (mm, g, bar, g/cm3, degrees, degC) and SI, as an operand. */
const literal =
  /[*/] ?\(?(1e-?3|1e-?6|1e-?5|1e5|1000|5e-4|0\.001)\b|\b(1e-?3|1e-?6|1e5|1000|5e-4|0\.001) ?[*/]|273\.15|Math\.PI\)? ?\/ ?180|180\)? ?\/ ?Math\.PI/

/** Lines that use such a number for something else: time, bytes, pixels, rotation speed, tolerances. */
const other: [file: string, text: string][] = [
  ['apps/web/src/lib/api-client.ts', 'out.retryAfter * 1000'],
  ['apps/web/src/lib/user-data.ts', 'maxFileBytes / 1e6'],
  ['apps/web/src/components/saved-loads.tsx', 'bytes'],
  ['packages/api/src/compute/pool.ts', 'timeoutMs / 1000'],
  ['apps/web/src/lib/units.ts', 'msText'],
  ['apps/web/src/lib/charge-target.ts', "symbol: 'ms'"],
  ['apps/web/src/components/chart-playback.tsx', '/ 1000 / c.factor'],
  ['apps/web/src/components/chart-playback.tsx', 'factor / 1000'],
  ['apps/web/src/components/workbench-readouts.tsx', 'msUnit'],
  ['apps/web/src/components/workbench-readouts.tsx', 'krpm'],
  ['apps/web/src/components/lot-chart.tsx', '* 1e3'],
  ['apps/web/src/components/use-lot-rows.ts', 'requestTimeout / 1000'],
  ['apps/web/src/components/use-lot-rows.ts', 'Number(target) * 1e-3'],
  ['apps/web/src/components/use-barrel-study.ts', 'requestTimeout / 1000'],
  ['apps/web/src/lib/interior-chart.ts', "x === 'time'"],
  ['apps/web/src/components/target-export.tsx', 'box.w / 1000'],
  ['apps/web/src/components/target-export.tsx', 'width: 1000'],
  ['apps/web/src/lib/bullet-compare.ts', 'em * 1100'],
  ['apps/web/src/lib/power-factor.ts', '(velocity / metersPerFoot)'],
  ['apps/web/src/lib/burn-rate.ts', 'perPa * 1e6'],
  ['apps/web/src/lib/record-fields.ts', '/ 1e6'],
  ['apps/web/src/lib/face-image.ts', '1e-6 *'],
]

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx|mts)$/.test(f))
    .map((f) => `${dir}/${f}`)
}

describe('stored-to-SI conversion', () => {
  it('has no factor literal outside the unit table in the API and the web app sources', () => {
    const found: string[] = []
    for (const file of [...sources('packages/api/src'), ...sources('apps/web/src')]) {
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const code = line.trim()
          if (/^(\/\/|\/?\*)/.test(code) || !literal.test(code)) return
          if (other.some(([f, text]) => f === file && code.includes(text))) return
          found.push(`${file}:${i + 1}: ${code}`)
        })
    }
    expect(found).toEqual([])
  })

  it('lists only lines that still hold such a literal', () => {
    const lines = new Map<string, string[]>()
    for (const [file] of other) lines.set(file, readFileSync(join(root, file), 'utf8').split('\n'))
    const stale = other.filter(
      ([file, text]) => !(lines.get(file) ?? []).some((l) => l.includes(text) && literal.test(l)),
    )
    expect(stale).toEqual([])
  })
})
