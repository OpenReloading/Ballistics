// Kind accuracy and unit exactness of the Import entry modules, over generated header variants.
// Run in the dev container after `npm run build`: node prototype/import-entry/accuracy.mts

import { idOfKey } from '../../apps/web/src/lib/import-entry/ids.ts'
import { inspectFile, type TableCard } from '../../apps/web/src/lib/import-entry/inspect.ts'
import { buildRecords } from '../../apps/web/src/lib/import-entry/map.ts'

const enc = (rows: string[][], d = ',') =>
  new TextEncoder().encode(rows.map((r) => r.join(d)).join('\n'))
const now = '2026-10-28T00:00:00.000Z'

type Variant = { kind: string | undefined; name: string; bytes: Uint8Array }
const variants: Variant[] = []
const bulletHeaders = [
  ['Name', 'Diameter (in)', 'Weight (gr)'],
  ['Description', 'Dia in', 'Grains'],
  ['Bullet', 'Diameter [mm]', 'Mass [g]'],
  ['Bezeichnung', 'Durchmesser mm', 'Gewicht g', 'Hersteller'],
  ['Product', 'Caliber', 'Diameter', 'Wt gr', 'G1'],
  ['Item', 'Maker', 'Dia', 'Weight (gr)', 'Length (in)', 'G7'],
]
const bulletCell = (c: string): string => {
  const rules: [RegExp, string][] = [
    [/name|desc|bullet$|bezeich|product|item/i, 'Demo X'],
    [/maker|hersteller/i, 'Demo Maker'],
    [/cal/i, '.308'],
    [/dia|durch/i, /mm/i.test(c) ? '7.82' : '0.308'],
    [/gr|grain|wt|weight|gewicht|mass/i, /\bg\]|\bg$/.test(c) ? '10.9' : '168'],
    [/len/i, '1.2'],
  ]
  return rules.find(([re]) => re.test(c))?.[1] ?? '0.45'
}
const bulletRow = (h: string[]) => h.map(bulletCell)
for (const [i, h] of bulletHeaders.entries())
  variants.push({
    kind: 'bullet',
    name: `bullet-${i}`,
    bytes: enc([h, bulletRow(h), bulletRow(h), bulletRow(h)]),
  })
const powderHeaders = [
  ['Name', 'Grain form', 'Base'],
  ['Powder', 'Shape', 'Propellant base', 'Bulk density'],
  ['Name', 'Form', 'Basis', 'Schuettdichte g/cm3'],
  ['Item', 'Maker', 'Kornform', 'Base'],
  ['Name', 'Density (g/cm3)', 'Base'],
]
const pv = (h: string) =>
  /form|shape|korn/i.test(h)
    ? 'extruded'
    : /base|basis/i.test(h)
      ? 'single'
      : /dens|schuett/i.test(h)
        ? '0.92'
        : /maker/i.test(h)
          ? 'Demo Co'
          : 'Demo P'
for (const [i, h] of powderHeaders.entries())
  variants.push({
    kind: 'powder',
    name: `powder-${i}`,
    bytes: enc([h, h.map(pv), h.map(pv), h.map(pv)]),
  })
const cartHeaders = [
  ['Name', 'Case length', 'Bullet diameter', 'Pmax'],
  ['Cartridge', 'L3 (mm)', 'G1 (mm)', 'Max pressure (bar)'],
  ['Name', 'Case length mm', 'COAL mm', 'Pressure bar'],
  ['Bezeichnung', 'Huelsenlaenge', 'Geschossdurchmesser', 'Pmax bar'],
  ['Name', 'Case length', 'Overall length'],
]
const cv = (h: string) =>
  /case|l3|huelsen/i.test(h)
    ? '51.2'
    : /coal|overall/i.test(h)
      ? '71.1'
      : /dia|g1|durch/i.test(h)
        ? '7.82'
        : /p/i.test(h) && /bar|pmax|press/i.test(h)
          ? '4150'
          : 'Demo C'
for (const [i, h] of cartHeaders.entries())
  variants.push({
    kind: 'cartridge',
    name: `cartridge-${i}`,
    bytes: enc([h, h.map(cv), h.map(cv), h.map(cv)]),
  })
variants.push({
  kind: undefined,
  name: 'unrelated-0',
  bytes: enc([
    ['Date', 'City', 'Temp'],
    ['2026-01-01', 'A', '3.5'],
    ['2026-01-02', 'B', '4'],
  ]),
})
variants.push({
  kind: undefined,
  name: 'unrelated-1',
  bytes: enc([
    ['Id', 'Score', 'Team'],
    ['1', '9.5', 'Red'],
    ['2', '8.0', 'Blue'],
  ]),
})
variants.push({
  kind: undefined,
  name: 'unrelated-2',
  bytes: enc([
    ['Name', 'Email', 'Phone'],
    ['A', 'a@example.org', '123'],
    ['B', 'b@example.org', '456'],
  ]),
})

let right = 0
const rows: string[] = []
for (const v of variants) {
  const c = (await inspectFile(v.name, v.bytes, now)) as TableCard
  const ok = c.kind === v.kind
  if (ok) right++
  rows.push(
    `${ok ? 'ok  ' : 'MISS'} ${v.name.padEnd(12)} want ${String(v.kind).padEnd(9)} got ${String(c.kind).padEnd(9)} ${c.tier ?? '-'} ${c.scores.map((s) => `${s.kind[0]}${s.score.toFixed(2)}`).join(' ')}`,
  )
}
console.log(rows.join('\n'))
console.log(`kind accuracy: ${right}/${variants.length}`)

// exact units: grains, inches and millimetres against the defined factors (1 gr = 64.79891 mg, 1 in = 25.4 mm)
const ctx = { source: 's', file: 'f', day: '2026-10-28', now }
const check = async (
  header: string[],
  row: string[],
  want: { mass: number; diameter: number },
  d = ',',
) => {
  const c = (await inspectFile('u.csv', enc([header, row], d), now)) as TableCard
  const b = buildRecords(c.table, 'bullet', c.map, ctx, idOfKey)
  const rec = b.entries[0]?.record
  const o = rec?.kind === 'bullet' ? rec.data.overrides : undefined
  return {
    mass: Math.abs((o?.mass?.value ?? NaN) - want.mass),
    diameter: Math.abs((o?.diameter?.value ?? NaN) - want.diameter),
  }
}
const grams = (gr: number) => (gr * 64.79891) / 1000
const cases = [
  await check(['Name', 'Diameter (in)', 'Weight (gr)'], ['T', '0.308', '168'], {
    mass: grams(168),
    diameter: 0.308 * 25.4,
  }),
  await check(['Name', 'Diameter (mm)', 'Weight (g)'], ['T', '7.82', '10.89'], {
    mass: 10.89,
    diameter: 7.82,
  }),
  await check(
    ['Name', 'Diameter mm', 'Weight g'],
    ['T', '7,82', '10,89'],
    { mass: 10.89, diameter: 7.82 },
    ';',
  ),
]
console.log(
  'unit conversion, largest absolute error (g, mm):',
  Math.max(...cases.flatMap((x) => [x.mass, x.diameter])),
)
