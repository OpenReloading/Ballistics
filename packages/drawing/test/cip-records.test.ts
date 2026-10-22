import { expect, it } from 'vitest'
import {
  type Drawn,
  type FigureModel,
  figureModel,
  screenEm,
  screenWidth,
} from '../src/cartridge/figure.ts'
import { recordFigures } from '../src/cartridge/figures.ts'
import {
  cipProfile,
  closedFront,
  drawnTables,
  type Profile,
  storedValue,
} from '../src/cartridge/profile.ts'
import { type Region, regions, regionText } from '../src/cartridge/regions.ts'
import * as face from '../src/core/face.ts'
import {
  arrowheadCorners,
  boxDistance,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segHitsBox,
  segsCross,
} from '../src/core/geometry.ts'
import { headFace, type PartPoint, radiusAt, steelBand } from '../src/core/section.ts'
import type {
  Dimension,
  Label,
  Layout,
  LineSegment,
  SectionPoint,
  SpecValue,
} from '../src/core/types.ts'
import type { LengthUnit } from '../src/core/units.ts'
import { type SpecRecord, sheets, undimensionedValues } from './sheets.ts'

const current = sheets
const records = current.filter((r) => drawnTables.has(r.table ?? ''))
const sides = ['cartridge', 'chamber'] as const
type Side = (typeof sides)[number]
const base = ['R1', 'R', 'P1', 'L3', 'H2']

/**
 * Profiles both sides; pushes each broken invariant to failures and returns the codes per side,
 * closedFront last on the cartridge side.
 */
function sweep(id: string, values: SpecValue[], failures: string[], table?: string) {
  return sides.map((side) => {
    const p = cipProfile(values, side, table)
    const fail = (what: string) => failures.push(`${id} ${side} ${what}`)
    const closed = side === 'cartridge' && closedFront(values) ? ['closedFront'] : []
    if ('missing' in p) {
      if (!p.missing.length || p.missing.some((s) => !base.includes(s)))
        fail(`missing ${p.missing}`)
      return [`missing:${p.missing}`, ...closed]
    }
    const [first] = p.points
    if (first[0] !== 0 || first[1] !== 0) fail(`starts at ${first}`)
    p.points.forEach(([r, z], k) => {
      if (!Number.isFinite(r) || !Number.isFinite(z) || r < 0) fail(`point ${k} at ${r}, ${z}`)
      if (k && z < p.points[k - 1][1]) fail(`z falls at point ${k}`)
    })
    const P1 = find(values, side, 'P1') as number
    if (side === 'chamber' && p.points[1][0] < P1 / 2) fail(`head ${p.points[1][0]} below P1`)
    const codes = p.notes.map((n) => n.code)
    if (table === 'III' && codes.includes('grooveAngle')) fail('grooveAngle on table III')
    for (const what of annotationFailures(p, values, side, table)) fail(what)
    return [...codes, ...closed]
  })
}

const find = (values: SpecValue[], side: Side, symbol: string) =>
  storedValue(values, side, symbol)?.value

/**
 * What breaks the annotation rules of a drawn side: values stored or derived (L3 - L2 > 0), angle
 * vertices on both drawn flanks, radius corners and edges on the outline before rounding, nothing
 * dimensioned on a convention.
 */
function annotationFailures(
  p: Profile,
  values: SpecValue[],
  side: Side,
  table?: string,
  variant?: string,
) {
  const out: string[] = []
  const { dimensions, angles, radii, edges, conventions } = p.annotation
  // the outline before rounding: the fillet corners as drawn without r0, r1 and r2
  const sharp = table === 'VII' ? p.points : unrounded(values, side, table).points
  const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol
  for (const d of dimensions) {
    const name = `${d.kind} ${d.symbol}`
    if (d.derived) {
      const [L2, L3] = ['L2', 'L3'].map((s) => find(values, side, s) as number)
      if (
        d.symbol !== 'L3\u2212L2' ||
        !near(d.value, L3 - L2, 5e-4) ||
        !near(d.to - d.from, L3 - L2, 1e-9)
      )
        out.push(`${name} is not L3 - L2`)
      else if (!(d.to - d.from > 0)) out.push(`${name} spans ${d.to - d.from}`)
      continue
    }
    const v = d.stored
    if (
      !v ||
      !values.includes(v) ||
      v.side !== side ||
      v.symbol !== d.symbol ||
      (v.variant !== undefined && v.variant !== variant) ||
      v.value !== d.value
    )
      out.push(`${name} is not a stored value`)
    else if (d.kind === 'diameter' ? d.radius !== d.value / 2 : !near(d.to - d.from, d.value, 1e-9))
      out.push(`${name} spans ${d.to - d.from}, stored ${d.value}`)
    if (d.symbol === 'e' && find(values, side, 'e') === undefined) out.push('derived e dimensioned')
    // a length's extension line starts at the outline or the steel band, never on a convention
    for (const c of d.kind === 'diameter' ? conventions : [])
      if (d.from > c.from + 1e-9 && d.from <= c.to + 1e-9 && near(d.radius as number, c.r))
        out.push(`${name} ends on the ${c.kind}`)
  }
  const mirrored = (sign: number) => sharp.map(([r, z]): SectionPoint => [sign * r, z])
  const onLine = ([r, z]: SectionPoint, [r0, z0]: SectionPoint, [r1, z1]: SectionPoint) =>
    Math.abs((r1 - r0) * (z - z0) - (z1 - z0) * (r - r0)) / Math.hypot(r1 - r0, z1 - z0) <= 0.01
  const onOutline = (q: SectionPoint, line: SectionPoint[]) =>
    line.some(
      (a, k) =>
        k > 0 &&
        onLine(q, line[k - 1], a) &&
        Math.min(a[1], line[k - 1][1]) - 0.01 <= q[1] &&
        q[1] <= Math.max(a[1], line[k - 1][1]) + 0.01,
    )
  for (const a of angles) {
    if (!values.includes(a.stored) || a.stored.value !== a.value)
      out.push(`angle ${a.symbol} not stored`)
    for (const f of a.flanks) {
      const line = mirrored(f[0] < 0 ? -1 : 1)
      const k = line.findIndex(([r, z]) => near(r, f[0], 1e-9) && near(z, f[1], 1e-9))
      // a flank along the axis (delta) or the head face (beta) is a construction line
      const flank =
        f[0] === a.vertex[0] || f[1] === a.vertex[1]
          ? onOutline(a.vertex, line)
          : k >= 0 &&
            [line[k - 1], line[k + 1]].some(
              (g) => g && Math.hypot(g[0] - f[0], g[1] - f[1]) > 1e-9 && onLine(a.vertex, f, g),
            )
      if (!flank) out.push(`angle ${a.symbol} vertex off its flank at ${f}`)
    }
  }
  for (const c of radii)
    if (!sharp.some(([r, z]) => r === c.corner[0] && z === c.corner[1]))
      out.push(`radius ${c.symbol} off the corner before rounding`)
  const zs = new Set([...p.points, ...sharp].map(([, z]) => z))
  for (const z of edges) if (!zs.has(z)) out.push(`edge at ${z} not on the outline`)
  return out
}
const without = (values: SpecValue[], side: Side, symbol: string) =>
  values.filter((v) => v.side !== side || v.symbol !== symbol)
const withValue = (values: SpecValue[], symbol: string, value: number, side: Side = 'chamber') => [
  ...without(values, side, symbol),
  { side, symbol, quantity: ['i', 'delta', 'beta'].includes(symbol) ? 'angle' : 'length', value },
]
/** The profile of a side without its fillets r0, r1 and r2: each corner as before rounding. */
const unrounded = (values: SpecValue[], side: Side, table?: string) =>
  cipProfile(
    ['r0', 'r1', 'r2'].reduce((v, symbol) => without(v, side, symbol), values),
    side,
    table,
  ) as Profile

it('draws every record with the reviewed notes', () => {
  const failures: string[] = []
  const codes = records.flatMap(({ id, values, table }) =>
    sweep(id, values, failures, table).flatMap((c, k) => c.map((code) => [id, sides[k], code])),
  )
  expect(failures).toEqual([])
  expect(codes).toEqual([
    ['cip-10-x-22-t-2004-09-27', 'cartridge', 'grooveAngle'],
    ['cip-10-x-22-t-2004-09-27', 'cartridge', 'shoulderPartial'],
    ['cip-10-x-22-t-2004-09-27', 'cartridge', 'closedFront'],
    ['cip-10-x-22-t-2004-09-27', 'chamber', 'missing:R1'],
    ['cip-10-x-23-t-2005-05-25', 'cartridge', 'shoulderPartial'],
    ['cip-10-x-23-t-2005-05-25', 'cartridge', 'closedFront'],
    ['cip-10-x-31-2016-10-18', 'cartridge', 'closedFront'],
    ['cip-10-x-31-2016-10-18', 'chamber', 'cartridgeR'],
    ['cip-10tk-2017-05-17', 'cartridge', 'closedFront'],
    ['cip-10tk-2017-05-17', 'chamber', 'cartridgeR'],
    ['cip-11-5-fk-2021-04-07', 'chamber', 'headBelowP1'],
    ['cip-12-7-x-70-500-sch-ler-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-14-mm-piexon-2004-09-27', 'cartridge', 'shoulderPartial'],
    ['cip-14-mm-piexon-2004-09-27', 'cartridge', 'closedFront'],
    ['cip-14-mm-piexon-2004-09-27', 'chamber', 'shoulderPartial'],
    ['cip-14-mm-piexon-2004-09-27', 'chamber', 'mouthStep'],
    ['cip-17-libra-2002-05-15', 'cartridge', 'grooveAngle'],
    ['cip-18-x-81-2000-06-07', 'chamber', 'noG1'],
    ['cip-22-long-blanc-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-22-long-rifle-shot-claybirding-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-22-long-shot-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-264-leroy-n-e-2002-05-15', 'cartridge', 'grooveAngle'],
    ['cip-277-gs-2011-05-25', 'chamber', 'headBelowP1'],
    ['cip-297-230-morris-lg-2000-06-07', 'cartridge', 'missing:R1'],
    ['cip-30-284-nolasco-2009-05-05', 'chamber', 'headBelowP1'],
    ['cip-30-284-win-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-30-super-belt-riml-h-h-2002-05-15', 'chamber', 'missing:R1,P1,L3,H2'],
    ['cip-30-super-carry-2025-05-13', 'chamber', 'noLeade'],
    ['cip-300-savage-2002-05-15', 'chamber', 'leadeAngle'],
    ['cip-315-blanc-1994-03-01', 'cartridge', 'shoulderPartial'],
    ['cip-315-blanc-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-315-blanc-1994-03-01', 'chamber', 'missing:R1'],
    ['cip-32-40-win-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-32-40-win-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-32-40-win-2002-05-15', 'chamber', 'mouthCone'],
    ['cip-32-40-win-2002-05-15', 'chamber', 'leadeStartBelowH'],
    ['cip-32-win-sl-2002-05-15', 'cartridge', 'grooveDerivedE'],
    ['cip-320-court-blanc-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-320-court-blanc-1994-03-01', 'chamber', 'leadeAngle'],
    ['cip-333-riml-n-e-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-35-blanc-1994-06-01', 'cartridge', 'grooveAngle'],
    ['cip-35-blanc-1994-06-01', 'cartridge', 'shoulderPartial'],
    ['cip-35-blanc-1994-06-01', 'chamber', 'missing:R1'],
    ['cip-35-gr-1994-06-01', 'cartridge', 'grooveAngle'],
    ['cip-35-gr-1994-06-01', 'cartridge', 'closedFront'],
    ['cip-35-gr-1994-06-01', 'chamber', 'missing:R1'],
    ['cip-35-r-blanc-1994-03-01', 'cartridge', 'shoulderPartial'],
    ['cip-35-r-gr-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-357-magnum-carb-2005-11-02', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-375-h-lderlin-2007-05-14', 'chamber', 'headBelowP1'],
    ['cip-375-win-2010-05-26', 'cartridge', 'shoulderPartial'],
    ['cip-375-win-2010-05-26', 'chamber', 'shoulderPartial'],
    ['cip-376-steyr-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-38-357-fx-2000-06-07', 'chamber', 'mouthStep'],
    ['cip-38-45-acp-2000-06-07', 'cartridge', 'grooveAngle'],
    ['cip-38-special-carb-1995-05-10', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-38-spl-amu-2008-09-23', 'cartridge', 'grooveDerivedE'],
    ['cip-380-alfa-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-380-gr-9-mm-r-gr-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-380-me-gum-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-380r-blanc-9-mm-r-blanc-1995-05-10', 'cartridge', 'closedFront'],
    ['cip-380r-blanc-9-mm-r-blanc-1995-05-10', 'chamber', 'leadeAngle'],
    ['cip-4-6-x-30-2025-03-17', 'cartridge', 'grooveAngle'],
    ['cip-4-mm-randz-court-blanc-1992-06-10', 'cartridge', 'closedFront'],
    ['cip-4-mm-randz-long-blanc-1992-06-10', 'cartridge', 'closedFront'],
    ['cip-40-x-46-deftec-2008-04-15', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-40-x-46-deftec-2008-04-15', 'chamber', 'missing:R1,R,P1,L3,H2'],
    ['cip-400-legend-2023-11-08', 'cartridge', 'chamferSkipped'],
    ['cip-400-legend-2023-11-08', 'chamber', 'mouthStep'],
    ['cip-401-win-sl-2002-05-15', 'cartridge', 'grooveDerivedE'],
    ['cip-404-riml-n-e-2020-04-21', 'chamber', 'headBelowP1'],
    ['cip-408-win-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-408-win-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-44-mag-gr-2000-06-07', 'cartridge', 'grooveAngle'],
    ['cip-44-mag-gr-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-44-rem-mag-carb-2020-11-10', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-44-s-w-special-carb-1995-05-10', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-45-blaser-2022-04-26', 'chamber', 'headBelowP1'],
    ['cip-45-colt-carb-1995-05-10', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-45-gap-2011-05-25', 'chamber', 'headBelowP1'],
    ['cip-45-k-blanc-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-45-k-blanc-1994-03-01', 'chamber', 'leadeAngle'],
    ['cip-45-l-gr-1993-10-20', 'cartridge', 'closedFront'],
    ['cip-45-s-w-schofield-carb-2000-02-15', 'cartridge', 'missing:R1,R,P1,L3,H2'],
    ['cip-450-sch-2013-05-22', 'chamber', 'headBelowP1'],
    ['cip-454-casull-2015-05-19', 'cartridge', 'grooveDerivedE'],
    ['cip-458-socom-2021-11-09', 'chamber', 'headBelowP1'],
    ['cip-5-45x18-2006-09-19', 'cartridge', 'grooveDerivedE'],
    ['cip-5-56-mm-fx-2017-05-17', 'chamber', 'headBelowP1'],
    ['cip-5-56-mm-mt-x-2024-05-14', 'chamber', 'headBelowP1'],
    ['cip-5-6-mm-flobert-plombs-dc-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-5-6-mm-flobert-plombs-sc-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-50-70-govt-2017-05-17', 'chamber', 'mouthStep'],
    ['cip-50-90-sharps-2-1-2-2017-05-17', 'cartridge', 'shoulderPartial'],
    ['cip-50-90-sharps-2-1-2-2017-05-17', 'chamber', 'shoulderPartial'],
    ['cip-50-90-sharps-2-1-2-2017-05-17', 'chamber', 'mouthStep'],
    ['cip-57tk-2017-05-17', 'cartridge', 'closedFront'],
    ['cip-6-5-x-54-mauser-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-6-5-x-57-r-2002-05-15', 'chamber', 'leadeStartBelowH'],
    ['cip-6-5-x-58-mauser-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-6-5-x-58-r-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-6-5-x-58-r-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-6-5-x-63-messner-mag-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-6-5-x-68-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-6-5-x-70-r-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-6-5-x-70-r-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-6-8-mm-rem-spc-2006-05-16', 'chamber', 'leadeAngle'],
    ['cip-6-8-western-2022-11-22', 'chamber', 'leadeStartBelowH'],
    ['cip-6-mm-flobert-blanc-2008-04-15', 'cartridge', 'closedFront'],
    ['cip-6-mm-rem-2023-05-09', 'chamber', 'throatDatum'],
    ['cip-7-21-firebird-2008-09-23', 'cartridge', 'grooveAngle'],
    ['cip-7-62-nagant-2000-06-07', 'cartridge', 'shoulderOrder'],
    ['cip-7-62-nagant-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-7-62-nagant-2000-06-07', 'chamber', 'shoulderOrder'],
    ['cip-7-92-x-24-vbr-2007-05-14', 'chamber', 'throatDatum'],
    ['cip-7-mm-rem-ultra-mag-2002-05-15', 'chamber', 'leadeAngle'],
    ['cip-7-mm-se-v-h-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-7-mm-weath-mag-2002-05-15', 'chamber', 'leadeAngle'],
    ['cip-7-x-67-r-luyven-2006-05-16', 'cartridge', 'missing:R1'],
    ['cip-8-5-mm-messner-mag-2013-05-22', 'chamber', 'headBelowP1'],
    ['cip-8-5-x-68-fanzoj-2012-05-30', 'chamber', 'headBelowP1'],
    ['cip-8-mm-blanc-2008-09-23', 'cartridge', 'shoulderPartial'],
    ['cip-8-mm-blanc-2008-09-23', 'chamber', 'missing:R1'],
    ['cip-8-mm-gr-1994-03-01', 'cartridge', 'grooveAngle'],
    ['cip-8-mm-gr-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-8-mm-gr-1994-03-01', 'chamber', 'missing:R1'],
    ['cip-8-x-58-r-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-8-x-58-r-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-8-x-60-2011-05-25', 'chamber', 'headBelowP1'],
    ['cip-8-x-60-s-2006-09-19', 'chamber', 'headBelowP1'],
    ['cip-8-x-68-s-2006-09-19', 'chamber', 'headBelowP1'],
    ['cip-8-x-72-r-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-8-x-72-r-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-9-3-rsm-2021-11-09', 'chamber', 'headBelowP1'],
    ['cip-9-3-x-62-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-9-3-x-64-brenneke-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-9-3-x-66-sako-2006-09-19', 'chamber', 'headBelowP1'],
    ['cip-9-3-x-72-r-2002-05-15', 'cartridge', 'shoulderPartial'],
    ['cip-9-3-x-72-r-2002-05-15', 'chamber', 'shoulderPartial'],
    ['cip-9-5-x-66-se-v-h-2002-05-15', 'chamber', 'headBelowP1'],
    ['cip-9-mm-fx-cqt-2022-04-26', 'chamber', 'shoulderPartial'],
    ['cip-9-mm-mt-x-2022-04-26', 'cartridge', 'shoulderPartial'],
    ['cip-9-mm-pa-blanc-1994-03-01', 'cartridge', 'shoulderPartial'],
    ['cip-9-mm-pa-blanc-1994-03-01', 'cartridge', 'closedFront'],
    ['cip-9-mm-pa-blanc-1994-03-01', 'chamber', 'missing:R1'],
    ['cip-9-x-39-2018-05-16', 'chamber', 'headBelowP1'],
    ['cip-9-x-39-2018-05-16', 'chamber', 'mouthStep'],
    ['cip-9-x-57-2004-05-18', 'chamber', 'leadeStartBelowH'],
    ['cip-9mm-flobert-plombs-carton-2000-06-07', 'cartridge', 'closedFront'],
    ['cip-9mm-flobert-plombs-metal-2000-06-07', 'cartridge', 'closedFront'],
  ])
})

it('keeps the invariants with each symbol dropped', () => {
  const failures: string[] = []
  for (const { id, values, table } of records)
    for (const side of sides)
      for (const symbol of new Set(values.filter((v) => v.side === side).map((v) => v.symbol))) {
        const dropped = without(values, side, symbol)
        const both = sweep(`${id} without ${side} ${symbol}`, dropped, failures, table)
        const own = both[sides.indexOf(side)][0] ?? ''
        if (base.includes(symbol) && !(side === 'chamber' && symbol === 'R'))
          if (!own.startsWith('missing:') || !own.slice(8).split(',').includes(symbol))
            failures.push(`${id} without ${side} ${symbol}: drawn`)
        const shoulder = ['P2', 'L1', 'L2', 'H1']
        if (
          shoulder.includes(symbol) &&
          shoulder.every((s) => find(values, side, s) !== undefined) &&
          !own.startsWith('missing:') &&
          !both[sides.indexOf(side)].includes('shoulderPartial')
        )
          failures.push(`${id} without ${side} ${symbol}: no shoulderPartial`)
        const codes = both[1]
        const chamberRim = ['E', 'R'].some((s) => find(dropped, 'chamber', s) !== undefined)
        if (
          !codes[0]?.startsWith('missing') &&
          !chamberRim &&
          find(dropped, 'cartridge', 'R') !== undefined &&
          !codes.includes('cartridgeR')
        )
          failures.push(`${id} without ${side} ${symbol}: no cartridgeR`)
      }
  expect(failures).toEqual([])
})

it('names invalid i, G1 and s', () => {
  const failures: string[] = []
  let leades = 0
  for (const { id, values, table } of records) {
    const expectCode = (label: string, changed: SpecValue[], code: string) => {
      const codes = sweep(label, changed, failures, table)[1]
      if (!codes.includes(code)) failures.push(`${label}: ${codes} without ${code}`)
    }
    const [G1, G, F, i] = ['G1', 'G', 'F', 'i'].map((s) => find(values, 'chamber', s))
    if (G === undefined || F === undefined || 'missing' in cipProfile(values, 'chamber', table))
      continue
    expectCode(`${id} without G1`, without(values, 'chamber', 'G1'), 'noG1')
    expectCode(`${id} G1 = F`, withValue(values, 'G1', F), 'noLeade')
    if (G1 === undefined || G1 <= F) continue
    expectCode(`${id} without i`, without(values, 'chamber', 'i'), 'iInvalid')
    for (const bad of [0, -1, 90, Number.NaN])
      expectCode(`${id} i = ${bad}`, withValue(values, 'i', bad), 'iInvalid')
    if (i === undefined || !(i > 0 && i < 90)) continue
    leades++
    expectCode(`${id} s = -1`, withValue(values, 's', -1), 'leadeStartBelowH')
    const past = withValue(values, 's', G + 1)
    expectCode(`${id} s = G + 1`, past, 'leadeStartPastG')
    const { points } = cipProfile(past, 'chamber', table) as Profile
    // the leade start is clamped to the leade end, a step from G1 to F
    if (points.at(-3)?.[1] !== points.at(-2)?.[1])
      failures.push(`${id} s = G + 1: start not clamped`)
  }
  expect(failures).toEqual([])
  expect(leades).toBeGreaterThan(300)
})

it('names a table III belt it cannot draw', () => {
  const failures: string[] = []
  const belted = records.filter((r) => r.table === 'III' && find(r.values, 'cartridge', 'R3'))
  for (const { id, values, table } of belted) {
    const changes: [string, SpecValue[]][] = [
      ...['R3', 'delta', 'E1', 'e', 'E'].map((s): [string, SpecValue[]] => [
        `without ${s}`,
        without(values, 'cartridge', s),
      ]),
      ...[0, 90, Number.NaN].map((bad): [string, SpecValue[]] => [
        `delta = ${bad}`,
        withValue(values, 'delta', bad, 'cartridge'),
      ]),
    ]
    for (const [what, changed] of changes) {
      const codes = sweep(`${id} ${what}`, changed, failures, table)[0]
      if (!codes.includes('beltSkipped')) failures.push(`${id} ${what}: ${codes}`)
    }
  }
  expect(failures).toEqual([])
  expect(belted.length).toBe(40)
})

it('draws the head and the belt from R1 and R3 where they differ', () => {
  const points = (id: string, side: Side) => {
    const { values, table } = records.find((r) => r.id === id) as SpecRecord
    return (cipProfile(values, side, table) as Profile).points
      .slice(0, 9)
      .map(([r, z]) => [Number(r.toFixed(9)), Number(z.toFixed(9))])
  }
  // 30-378 Weath. Mag.: R1 14.71 at the head behind the f 0.3 mm, beta 45 degree chamfer, the belt
  // at R3 15.33, then P1 14.78 at E 6.4
  expect(points('cip-30-378-weath-mag-2002-05-15', 'cartridge')).toEqual([
    [0, 0],
    [7.055, 0],
    [7.355, 0.3],
    [7.355, 1.6],
    [6.285, 1.6],
    [6.285, 2.84],
    [7.665, 4.22],
    [7.665, 6.4],
    [7.39, 6.4],
  ])
  // 11,5 x 51: the chamber recess at R3 13.59, not R1 13.51, to E 5.59, then P1 13.06
  expect(points('cip-11-5-x-51-2009-05-05', 'chamber').slice(0, 4)).toEqual([
    [0, 0],
    [6.795, 0],
    [6.795, 5.59],
    [6.53, 5.59],
  ])
})

it('draws the rim chamfer where f and beta are stored, beta from the head face line', () => {
  const inset = (id: string) => {
    const { values, table } = records.find((r) => r.id === id) as SpecRecord
    const { points } = cipProfile(values, 'cartridge', table) as Profile
    return points[2][0] - points[1][0]
  }
  // f / tan(beta): 0.38 / tan(35 deg), 0.6 / tan(20 deg), 0.91 / tan(72 deg)
  expect(Math.abs(inset('cip-308-match-2014-05-20') - 0.543)).toBeLessThan(0.001)
  expect(Math.abs(inset('cip-7-62-x-54-r-2014-05-20') - 1.65)).toBeLessThan(0.01)
  expect(Math.abs(inset('cip-6-5-x-64-brenneke-2013-05-22') - 0.3)).toBeLessThan(0.01)
  const counts = { both: 0, drawn: 0, notTimesTan: 0, skipped: [] as string[], withR0: 0 }
  for (const { id, values, table } of records) {
    const p = cipProfile(values, 'cartridge', table)
    const [f, beta, r0] = ['f', 'beta', 'r0'].map((s) => find(values, 'cartridge', s))
    if ('missing' in p || f === undefined || beta === undefined) continue
    counts.both++
    if (r0 !== undefined) counts.withR0++
    if (p.notes.some((n) => n.code === 'chamferSkipped')) counts.skipped.push(id)
    const mark = p.annotation.angles.find((a) => a.symbol === 'beta')
    if (!mark) continue
    counts.drawn++
    // the arc vertex is the chamfer foot on the head face
    expect(mark.vertex).toEqual(p.points[1])
    if (Math.abs(p.points[2][0] - p.points[1][0] - f * Math.tan((beta * Math.PI) / 180)) > 0.001)
      counts.notTimesTan++
  }
  expect(counts).toEqual({
    both: 444,
    drawn: 443,
    notTimesTan: 194,
    skipped: ['cip-400-legend-2023-11-08'],
    withR0: 0,
  })
})

it('rounds the 8 x 51 R Lebel rim corner with r0', () => {
  const { values, table } = records.find(
    (r) => r.id === 'cip-8-x-51-r-lebel-2015-05-19',
  ) as SpecRecord
  const p = cipProfile(values, 'cartridge', table) as Profile
  expect(p.annotation.radii.find((r) => r.symbol === 'r0')).toMatchObject({
    value: 1.4,
    corner: [(find(values, 'cartridge', 'R1') as number) / 2, 0],
  })
  const end = p.points[9]
  expect(end[0]).toBeCloseTo((find(values, 'cartridge', 'R1') as number) / 2, 9)
  expect(end[1]).toBeCloseTo(1.4, 9)
})

/** r of the outline at z inside a segment that is not a step, the axis segment left out. */
function rAt(points: SectionPoint[], z: number) {
  for (let k = 1; k + 1 < points.length; k++) {
    const [[r0, z0], [r1, z1]] = [points[k], points[k + 1]]
    if (z0 < z && z < z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
  }
  return Number.NaN
}

/** z where the body ends: the point after P1 (or after P0 at L0), where r1 or the wall to H2 starts. */
function bodyEnd(p: Profile, values: SpecValue[], side: Side) {
  const P1 = p.annotation.dimensions.find((d) => d.symbol === 'P1') as Dimension
  let k = p.points.findLastIndex(([r, z]) => r === P1.radius && z === P1.from)
  const [P0, L0] = ['P0', 'L0'].map((s) => find(values, side, s))
  if (p.points[k + 1][0] === (P0 ?? 0) / 2 && p.points[k + 1][1] === L0) k++
  return p.points[k + 1][1]
}

it('keeps the chamber body around the cartridge body', () => {
  const gaps: [string, number][] = []
  let checked = 0
  for (const { id, values, table } of records) {
    const [c, ch] = sides.map((side) => cipProfile(values, side, table))
    if ('missing' in c || 'missing' in ch || closedFront(values)) continue
    checked++
    const end = Math.min(bodyEnd(c, values, 'cartridge'), bodyEnd(ch, values, 'chamber'))
    // both outlines are straight between their points, so the gap is smallest next to a point
    const zs = [...c.points, ...ch.points]
      .flatMap(([, z]) => [z - 1e-6, z + 1e-6])
      .filter((z) => z > 0 && z < end)
    const gap = Math.min(...zs.map((z) => rAt(ch.points, z) - rAt(c.points, z)))
    if (!(gap >= -0.01)) gaps.push([id, Number(gap.toFixed(3))])
  }
  expect(checked).toBe(518)
  // Reviewed: chamber R, a minimum, is below cartridge R, a maximum, by 0.02 to 0.1 mm, so the
  // stored rim is thicker than the stored recess; between the two R the rim (R1/2) meets the
  // chamber body (P1/2). 22 BB Cap and 22 CB Cap: R 1.12 against 1.1, R1 7.06 against P1 5.76;
  // 22 Extra Long: R 1.12 against 1.1, R1 7.06 against P1 5.78; 380 Long Rifle: R 1.32 against
  // 1.3, R1 11.05 against P1 9.68; 4 mm Randz court and long: R 1.3 against 1.2, R1 6.1 against
  // P1 4.7.
  expect(gaps).toEqual([
    ['cip-22-bb-cap-2000-06-07', -0.65],
    ['cip-22-cb-cap-2000-06-07', -0.65],
    ['cip-22-extra-long-2000-06-07', -0.64],
    ['cip-380-long-rifle-2002-05-15', -0.685],
    ['cip-4-mm-randz-court-2000-06-07', -0.701],
    ['cip-4-mm-randz-long-2000-06-07', -0.701],
  ])
})

/** Radius of a half-section polyline at z, inside a segment that is not a step. */
const radius = (points: SectionPoint[], z: number) => {
  const k = points.findIndex(
    ([, z0], j) => j && points[j - 1][1] < z0 && points[j - 1][1] <= z && z <= z0,
  )
  if (k < 0) return Number.NaN
  const [[r0, z0], [r1, z1]] = [points[k - 1], points[k]]
  return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
}

/** Largest amount the cartridge lies outside the chamber, and where, from the head to the mouth. */
function interference(cartridge: SectionPoint[], chamber: SectionPoint[]) {
  if (!cartridge.length || !chamber.length) return { by: 0, z: 0 }
  const end = (cartridge.at(-1) as SectionPoint)[1]
  const stations = [...new Set([...cartridge, ...chamber].map(([, z]) => z))]
    .filter((z) => z <= end)
    .sort((a, b) => a - b)
  let worst = { by: -Infinity, z: 0 }
  // both outlines are straight between stations, so the ends of each interval bound it
  for (const [k, a] of stations.entries())
    for (const z of k ? [stations[k - 1] + 1e-9, a - 1e-9] : []) {
      // past the chamber end the radius is NaN: a hull longer than the chamber fails
      const by = radius(cartridge, z) - radius(chamber, z)
      if (Number.isNaN(by) || by > worst.by) worst = { by: Number.isNaN(by) ? Infinity : by, z }
    }
  return worst
}

it('draws every variant of every current table VII record to one span, chamber around the hull', () => {
  const shotshells = current.filter((r) => r.table === 'VII')
  const failures: string[] = []
  const tight: string[] = []
  for (const { id, values } of shotshells) {
    const lengths = (side: Side, symbol: string) =>
      values.filter((v) => v.side === side && v.symbol === symbol).map((v) => v.variant)
    if (lengths('cartridge', 'l').join() !== lengths('chamber', 'L').join())
      failures.push(`${id} l and L variants differ`)
    // the figures as the component draws them, all to the span of the longest
    const list = recordFigures({ id, standard: 'CIP', table: 'VII', values })
    for (const figure of list) {
      const { variant, drawn } = figure
      const name = variant === undefined ? id : `${id} ${variant}`
      for (const n of figure.notes) failures.push(`${name} ${n.code} ${n.text}`)
      for (const { side, p } of drawn) {
        p.points.forEach(([r, z], k) => {
          if (!Number.isFinite(r) || !Number.isFinite(z) || r < 0)
            failures.push(`${name} ${side} point ${k}`)
          if (k && z < p.points[k - 1][1]) failures.push(`${name} ${side} z falls at point ${k}`)
        })
        const symbols = p.annotation.dimensions.map((d) => d.symbol)
        if (new Set(symbols).size !== symbols.length)
          failures.push(`${name} ${side} dimension twice`)
        for (const what of annotationFailures(p, values, side, 'VII', variant))
          failures.push(`${name} ${side} ${what}`)
      }
      const [cartridge, chamber] = sides.map(
        (side) => drawn.find((d) => d.side === side)?.p.points ?? [],
      )
      const { by, z } = interference(cartridge, chamber)
      if (by > 0.01) failures.push(`${name} cartridge ${by} mm outside the chamber at ${z} mm`)
      else if (by > 0) tight.push(`${name} ${by.toFixed(4)} at ${z.toFixed(2)}`)
    }
  }
  expect(failures).toEqual([])
  // Mori: hull d2 8.4 (a maximum, toward h 8.35) over chamber B 8.38 (a minimum) from L2 12.3
  expect(tight).toEqual(['cip-9-c-f-mori-2006-09-19 0.0098 at 12.30'])
  expect(shotshells.length).toBe(17)
})

interface Figure {
  name: string
  values: SpecValue[]
  table?: string
  variant?: string
  drawn: Drawn
  /** The caption notes, numbered where they have a flag. */
  notes: { flagNumber?: number }[]
  /** Text size and width across the screen column, shared by the figures of a record. */
  em: number
  across: number
  /** With both sides, the record's region differences for the Combined layer. */
  regions: Region[]
}

/** Distance from point p to the segment from a to b. */
function segDistance([x, y]: PartPoint, [ax, ay]: PartPoint, [bx, by]: PartPoint) {
  const [dx, dy] = [bx - ax, by - ay]
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

/** Distance from a point [r, z] to a half-section polyline. */
function distance([r, z]: SectionPoint, points: SectionPoint[]) {
  return Math.min(
    ...points.slice(1).map(([r1, z1], k) => {
      const [r0, z0] = points[k]
      const [dr, dz] = [r1 - r0, z1 - z0]
      const t = Math.max(0, Math.min(1, ((r - r0) * dr + (z - z0) * dz) / (dr * dr + dz * dz || 1)))
      return Math.hypot(r - r0 - t * dr, z - z0 - t * dz)
    }),
  )
}

/** Every figure the component draws for a record, with its screen text size. */
const allFigures = current.flatMap((record): Figure[] => {
  const shown = recordFigures(record).filter((f) => f.drawn.length)
  if (!shown.length) return []
  const em = screenEm(shown.map((f) => f.drawn))
  const across = Math.max(...shown.map((f) => screenWidth(f.drawn, em)))
  return shown.map(({ variant, drawn, notes }) => ({
    name: variant === undefined ? record.id : `${record.id} ${variant}`,
    notes,
    values: record.values,
    table: record.table,
    variant,
    drawn,
    em,
    across,
    regions: drawn.length === 2 ? regions(record.values) : [],
  }))
})
const models = new Map(
  allFigures.map((f) => [
    f,
    {
      screen: figureModel(f.drawn, 'screen', f.em, f.across, f.regions, true),
      print: figureModel(f.drawn, 'print', face.printEm, 0, f.regions),
    },
  ]),
)
/** Screen px per mm with the page column `column` px wide. */
const pxPerMm = ({ frame }: FigureModel, column: number) =>
  Math.min(face.pxPerMm, column / frame[2])

it('lays out every layer of every figure in both media clear of overlaps, inside the frame', () => {
  const failures: string[] = []
  let headBelowP1 = 0
  let beltWiderThanRim = 0
  const longLeaders: string[] = []
  const acrossAxis: string[] = []
  const arrowheads: string[] = []
  const reference = allFigures.find((f) => f.name === 'cip-308-win-2008-09-23') as Figure
  const referencePx = pxPerMm((models.get(reference) as { screen: FigureModel }).screen, 358)
  for (const figure of allFigures) {
    const { name, drawn, em } = figure
    const both = models.get(figure) as { screen: FigureModel; print: FigureModel }
    for (const column of [358, 1120])
      if (em * pxPerMm(both.screen, column) < face.minTextPx - 1e-9)
        failures.push(`${name} text ${em * pxPerMm(both.screen, column)} px at ${column}`)
    if (pxPerMm(both.screen, 358) > 3 * referencePx)
      failures.push(`${name} ${pxPerMm(both.screen, 358)} px per mm`)
    if (both.print.frame[2] > face.printWidth)
      failures.push(`${name} print ${both.print.frame[2]} mm wide`)
    for (const [medium, model] of Object.entries(both)) {
      const [fx, fy, fw, fh] = model.frame
      // the outer frame: screen x = part y, screen y = -part x
      const outer = ([x, y]: PartPoint): PartPoint => (medium === 'screen' ? [y, -x] : [x, y])
      const inside = (q: PartPoint) => {
        const [x, y] = outer(q)
        return x >= fx - 1e-6 && x <= fx + fw + 1e-6 && y >= fy - 1e-6 && y <= fy + fh + 1e-6
      }
      for (const { side, p } of drawn) {
        const layout = model.layers[side] as Layout
        const what = (x: string) => `${name} ${side} ${medium} ${x}`
        const lines: LineSegment[] = [
          ...layout.segs,
          ...layout.arcs.flatMap((a) =>
            Array.from({ length: 12 }, (_, k): LineSegment => {
              const t = (n: number) => a.from + ((a.to - a.from) * n) / 12
              return {
                a: [a.c[0] + a.r * Math.cos(t(k)), a.c[1] + a.r * Math.sin(t(k))],
                b: [a.c[0] + a.r * Math.cos(t(k + 1)), a.c[1] + a.r * Math.sin(t(k + 1))],
                kind: 'rule',
                owner: a.owner,
              }
            }),
          ),
        ]
        // the filled arrowheads as drawn, 1.1 by 0.7 mm
        const tips = layout.arrowheads.map((t) => ({
          owner: t.owner,
          corners: arrowheadCorners(t),
        }))
        // the edge lines as clipped to the section or the cavity, and the chamber break line
        const edges = p.annotation.edges.map((z): LineSegment => {
          const r = radiusAt(p.points, z) as number
          return { a: [z, -r], b: [z, r], kind: 'thin', owner: 'edge line' }
        })
        const breaks =
          side === 'chamber'
            ? steelBand(p.points, model.em).sides.flatMap(({ zig }) =>
                zig
                  .slice(1)
                  .map(
                    (b, n): LineSegment => ({ a: zig[n], b, kind: 'thin', owner: 'break line' }),
                  ),
              )
            : []
        layout.labels.forEach((l, k) => {
          const corners = labelCorners(l)
          if (!corners.every(inside)) failures.push(what(`${l.owner} text outside`))
          for (const m of layout.labels.slice(k + 1))
            if (boxesOverlap(l, m)) failures.push(what(`${l.owner} text overlaps ${m.owner}`))
          for (const s of lines)
            if (s.owner !== l.owner && segHitsBox(s, l))
              failures.push(what(`${s.owner} line crosses ${l.owner} text`))
          for (const s of [...edges, ...breaks])
            if (segHitsBox(s, l)) failures.push(what(`${s.owner} crosses ${l.owner} text`))
          for (const t of tips)
            if (t.owner !== l.owner && polygonsOverlap(t.corners, corners))
              failures.push(what(`${t.owner} arrowhead on ${l.owner} text`))
        })
        // arrowheads of two dimensions that still overlap, else listed
        tips.forEach((t, k) => {
          if (!t.corners.every(inside)) failures.push(what(`${t.owner} arrowhead outside`))
          for (const u of tips.slice(k + 1))
            if (u.owner !== t.owner && polygonsOverlap(t.corners, u.corners))
              arrowheads.push(what(`${t.owner} on ${u.owner}`))
        })
        // an angle text on a leader starts at its end, and the leader runs off the axis
        for (const s of layout.segs.filter(
          (x) => x.leader && layout.arcs.some((a) => a.owner === x.owner),
        )) {
          const l = layout.labels.find((x) => x.owner === s.owner) as Label
          const [dx, dy] = [s.b[0] - l.c[0], s.b[1] - l.c[1]]
          const [u, v] = [dx * l.dir[0] + dy * l.dir[1], -dx * l.dir[1] + dy * l.dir[0]]
          const off = Math.hypot(
            Math.max(Math.abs(u) - l.w / 2, 0),
            Math.max(Math.abs(v) - l.h / 2, 0),
          )
          if (off > 0.2 * model.em) failures.push(what(`${s.owner} text ${off} mm off its leader`))
          if (Math.max(Math.abs(s.a[1]), Math.abs(s.b[1])) < 0.25 * model.em)
            failures.push(what(`${s.owner} leader along the axis`))
        }
        // a radius leader within 3 times the face's leader, on its own side of the axis, else listed
        for (const s of layout.segs.filter(
          (x) => x.leader && p.annotation.radii.some((r) => r.symbol === x.owner),
        )) {
          const times =
            Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) /
            ((face.radiusLeaderLength * model.em) / face.baseEm)
          if (times > 3 + 1e-9) longLeaders.push(`${what(s.owner)} ${times.toFixed(2)}`)
          if (s.a[1] * s.b[1] < 0) acrossAxis.push(what(s.owner))
        }
        // an angle text without a leader lies within 2 em of its arc
        for (const a of layout.arcs) {
          if (layout.segs.some((x) => x.leader && x.owner === a.owner)) continue
          const l = layout.labels.find((x) => x.owner === a.owner) as Label
          const off = Math.min(
            ...Array.from({ length: 49 }, (_, k) =>
              boxDistance(l, [
                a.c[0] + a.r * Math.cos(a.from + ((a.to - a.from) * k) / 48),
                a.c[1] + a.r * Math.sin(a.from + ((a.to - a.from) * k) / 48),
              ]),
            ),
          )
          if (off > face.nearArc * model.em + 1e-9)
            failures.push(what(`${a.owner} text ${off / model.em} em off its arc, no leader`))
        }
        for (const s of lines)
          if (!inside(s.a) || !inside(s.b)) failures.push(what(`${s.owner} line outside`))
        for (const { owner, tips } of layout.diameterTips) {
          const d = p.annotation.dimensions.find((x) => x.symbol === owner) as Dimension
          for (const [z, r] of tips) {
            const off = distance([Math.abs(r), z], p.points)
            // a fillet rounds the corner where P2 and H1 are stored by up to 0.04 mm
            if (off > 0.01 || Math.abs(Math.abs(r) - (d.radius as number)) > 0.05)
              failures.push(
                what(`${owner} tip ${off} mm off the outline, at r ${r}, stored ${d.radius}`),
              )
          }
        }
        for (const { owner, length, outside, broken } of layout.spans)
          if (!broken && outside !== length < face.shortSpan * face.arrow.length)
            failures.push(what(`${owner} arrows ${outside ? 'outside' : 'inside'}`))
        // the extension lines of a chamber head diameter end, past their gap, on a drawn stroke
        if (side === 'chamber') {
          const head = headFace(p.points, p.annotation)
          if (!head !== !model.chamber?.face) failures.push(what('head face not as laid out'))
          const strokes = [
            ...steelBand(p.points, model.em).sides.map((s) => s.stroke),
            ...(head ? [head] : []),
          ]
          const checked = layout.segs.filter(
            (x) => x.kind === 'thin' && Math.abs(x.a[0] + face.extensionGap) < 1e-9,
          )
          // the two R1 lines of a headBelowP1 chamber are among the checked ones
          if (p.notes.some((n) => n.code === 'headBelowP1')) {
            if (checked.filter((x) => x.owner === 'R1').length !== 2)
              failures.push(what('R1 extension lines not checked'))
            else if (medium === 'screen') headBelowP1++
          }
          for (const s of checked) {
            const end: PartPoint = [0, s.a[1]]
            const off = Math.min(
              ...strokes.flatMap((st) => st.slice(1).map((b, n) => segDistance(end, st[n], b))),
            )
            if (off > 0.01) failures.push(what(`${s.owner} extension line ${off} mm off the head`))
          }
        }
        // the extension lines of a cartridge head diameter end, past their gap, on the outline
        if (side === 'cartridge') {
          const below = new Set(
            p.annotation.dimensions
              .filter((d) => d.kind === 'diameter' && d.behindHeadFace)
              .map((d) => d.symbol),
          )
          for (const s of layout.segs) {
            if (s.kind !== 'thin' || !below.has(s.owner) || s.a[1] !== s.b[1]) continue
            const off = distance([Math.abs(s.a[1]), s.a[0] + face.extensionGap], p.points)
            if (off > 0.01)
              failures.push(what(`${s.owner} extension line ${off} mm off the outline`))
            // a belt wider than the rim: its lines start past the head face
            if (s.owner === 'R3' && s.a[0] > 0 && s.a[1] > 0 && medium === 'screen')
              beltWiderThanRim++
          }
        }
      }
      // the Combined layer: one callout per region, clear of each other and inside the frame
      const combined = model.layers.combined
      const what = (x: string) => `${name} combined ${medium} ${x}`
      if (!figure.regions.length !== !combined) failures.push(what('layer not as the regions'))
      if (combined) {
        const texts = combined.labels.map((l) => l.text).sort()
        if (
          texts.join('|') !==
          figure.regions
            .map((r) => regionText(r))
            .sort()
            .join('|')
        )
          failures.push(what(`callouts ${texts.join('|')}`))
        const tips = combined.arrowheads.map((t) => ({
          owner: t.owner,
          corners: arrowheadCorners(t),
        }))
        combined.labels.forEach((l, k) => {
          if (!labelCorners(l).every(inside)) failures.push(what(`${l.owner} text outside`))
          for (const m of combined.labels.slice(k + 1))
            if (boxesOverlap(l, m, 0.12 * model.em))
              failures.push(what(`${l.owner} text overlaps ${m.owner}`))
          for (const s of combined.segs)
            if (s.owner !== l.owner && segHitsBox(s, l))
              failures.push(what(`${s.owner} leader crosses ${l.owner} text`))
          for (const t of tips)
            if (t.owner !== l.owner && polygonsOverlap(t.corners, labelCorners(l)))
              failures.push(what(`${t.owner} arrowhead on ${l.owner} text`))
          // past the steel band
          const outer =
            Math.max(...(drawn[1].p.points.map(([r]) => r) as number[])) + face.steelBandWidth
          if (Math.abs(l.c[1]) - l.h / 2 < outer) failures.push(what(`${l.owner} text on the part`))
        })
        for (const s of combined.segs)
          if (!inside(s.a) || !inside(s.b)) failures.push(what(`${s.owner} leader outside`))
      }
    }
  }
  expect(failures).toEqual([])
  expect(headBelowP1).toBe(31)
  expect(beltWiderThanRim).toBe(13)
  expect(longLeaders).toHaveLength(14)
  expect(acrossAxis).toHaveLength(17)
  expect(new Set(arrowheads).size).toBe(18)
  expect({ longLeaders, acrossAxis, arrowheads: [...new Set(arrowheads)] }).toMatchSnapshot()
})

// the record page prints each side upright: the screen layout at the print text size
const layoutsDrawn = {
  screen: (f: (typeof allFigures)[number], unit: LengthUnit) =>
    unit === 'mm'
      ? (models.get(f) as { screen: FigureModel }).screen
      : figureModel(f.drawn, 'screen', screenEm([f.drawn], unit), 0, [], true, unit),
  print: (f: (typeof allFigures)[number], unit: LengthUnit) =>
    unit === 'mm'
      ? (models.get(f) as { print: FigureModel }).print
      : figureModel(f.drawn, 'print', face.printEm, 0, [], false, unit),
  'page print': (f: (typeof allFigures)[number], unit: LengthUnit) =>
    figureModel(f.drawn, 'screen', face.printEm, 0, [], false, unit),
}

it.each(
  (['mm', 'in'] as const).flatMap((unit) =>
    (Object.keys(layoutsDrawn) as (keyof typeof layoutsDrawn)[]).map(
      (medium) => [medium, unit] as const,
    ),
  ),
)(
  'keeps every text a gap from the others and every angle text off its own arc (%s, %s)',
  (medium, unit) => {
    const failures: string[] = []
    const arcLines = (a: Layout['arcs'][number]) =>
      Array.from({ length: 24 }, (_, k): LineSegment => {
        const t = (n: number) => a.from + ((a.to - a.from) * n) / 24
        return {
          a: [a.c[0] + a.r * Math.cos(t(k)), a.c[1] + a.r * Math.sin(t(k))],
          b: [a.c[0] + a.r * Math.cos(t(k + 1)), a.c[1] + a.r * Math.sin(t(k + 1))],
          kind: 'rule',
          owner: a.owner,
        }
      })
    for (const figure of allFigures) {
      const { name, drawn } = figure
      const model = layoutsDrawn[medium](figure, unit)
      for (const { side } of drawn) {
        const layout = model.layers[side] as Layout
        const what = (x: string) => `${name} ${side} ${medium} ${unit} ${x}`
        const gap = 0.12 * model.em
        layout.labels.forEach((l, k) => {
          for (const m of layout.labels.slice(k + 1))
            if (boxesOverlap(l, m, gap)) failures.push(what(`${l.owner} text touches ${m.owner}`))
        })
        for (const a of layout.arcs) {
          const l = layout.labels.find((x) => x.owner === a.owner) as Label
          const own = [
            ...arcLines(a),
            ...layout.segs.filter((s) => s.owner === a.owner && !s.leader),
          ]
          if (own.some((s) => segHitsBox(s, l)))
            failures.push(what(`${a.owner} arc or flank through its text`))
          if (
            layout.arrowheads.some(
              (t) => t.owner === a.owner && polygonsOverlap(arrowheadCorners(t), labelCorners(l)),
            )
          )
            failures.push(what(`${a.owner} arrowhead on its text`))
          for (const b of layout.arcs)
            if (
              b.owner > a.owner &&
              arcLines(a).some((s) => arcLines(b).some((t) => segsCross(s.a, s.b, t.a, t.b)))
            )
              failures.push(what(`${a.owner} arc crosses ${b.owner} arc`))
        }
      }
    }
    expect(failures).toEqual([])
  },
  120_000,
)

it('flags every note and dimensions the head marks in the main view', () => {
  const failures: string[] = []
  for (const figure of allFigures) {
    const { name, drawn, notes } = figure
    const both = models.get(figure) as { screen: FigureModel; print: FigureModel }
    const caption = notes.flatMap((n) => (n.flagNumber ? [n.flagNumber] : []))
    for (const [medium, model] of Object.entries(both)) {
      const what = (x: string) => `${name} ${medium} ${x}`
      // flag numbers equal caption numbers
      const flags = drawn
        .flatMap(({ side }) => (model.layers[side] as Layout).labels)
        .filter((l) => l.ring)
        .map((l) => Number(l.text))
        .sort((a, b) => a - b)
      if (flags.join() !== caption.join()) failures.push(what(`flags ${flags} for ${caption}`))
      // delta, beta, r0 and f keep their labels in the main view
      for (const { side, p } of drawn) {
        const { dimensions, angles, radii } = p.annotation
        const owners = new Set((model.layers[side] as Layout).labels.map((l) => l.owner))
        for (const { symbol } of [...dimensions, ...angles, ...radii])
          if (['delta', 'beta', 'r0', 'f'].includes(symbol) && !owners.has(symbol))
            failures.push(what(`${side} ${symbol} not labelled`))
      }
    }
  }
  expect(failures).toEqual([])
})

it('adds the detail letters on screen without changing the frame or any other mark', () => {
  const failures: string[] = []
  const counts: Record<string, number> = {}
  const isLetter = (x: { owner: string }) => x.owner.startsWith('detail ')
  for (const figure of allFigures) {
    const { name, drawn } = figure
    const { screen, print } = models.get(figure) as { screen: FigureModel; print: FigureModel }
    const plain = figureModel(drawn, 'screen', figure.em, figure.across, figure.regions)
    if (screen.frame.join() !== plain.frame.join()) failures.push(`${name} frame`)
    if (print.details.length || plain.details.length) failures.push(`${name} details unasked`)
    for (const { side } of drawn) {
      const [a, b] = [screen.layers[side], plain.layers[side]] as Layout[]
      const rest = {
        ...a,
        labels: a.labels.filter((l) => !isLetter(l)),
        segs: a.segs.filter((x) => !isLetter(x)),
      }
      if (JSON.stringify(rest) !== JSON.stringify(b)) failures.push(`${name} ${side} marks moved`)
      const letters = a.labels.filter(isLetter).map((l) => l.text)
      const want = screen.details.filter((d) => d.side === side).map((d) => d.letter)
      if (letters.join() !== want.join()) failures.push(`${name} ${side} letters ${letters}`)
    }
    for (const d of screen.details) {
      const key = `${d.side} ${d.letter} ${d.scale}`
      counts[key] = (counts[key] ?? 0) + 1
    }
  }
  expect(failures).toEqual([])
  expect(counts).toMatchSnapshot()
})

it('counts the chamber recess steps and lists the other outline features under 1 px at 390 px', () => {
  let recess = 0
  const small: [string, Side, number][] = []
  for (const figure of allFigures) {
    const { name, values, table, drawn } = figure
    const perMm = pxPerMm((models.get(figure) as { screen: FigureModel }).screen, 358)
    const features = drawn.flatMap(({ side, p }) => {
      // a fillet counts as its corner, not as the 8 chords of its arc
      const sharp = table === 'VII' ? p : unrounded(values, side, table)
      // the chamber outline starts at the head, not on the axis
      const points = side === 'chamber' ? sharp.points.slice(1) : sharp.points
      return points.slice(1).flatMap(([r, z], k) => {
        const mm = Math.hypot(r - points[k][0], z - points[k][1])
        // under the step of the stored values a segment is rounding, not a feature: 0.01 mm, and
        // 0.005 mm for a radial step, half a diameter difference
        if (mm < (z === points[k][1] ? 0.005 : 0.01) - 1e-9 || mm * perMm >= 1) return []
        const recess = side === 'chamber' && table !== 'VII' && k === 1
        return [{ side, px: Number((mm * perMm).toFixed(2)), recess }]
      })
    })
    if (features.some((f) => f.recess)) recess++
    for (const { side, px } of features.filter((f) => !f.recess)) small.push([name, side, px])
  }
  expect(small).toHaveLength(14)
  expect({ recess, small }).toMatchSnapshot()
})

it('counts the drawn sides per table and bounds text size, scale and frame', () => {
  const tables: Record<string, Record<string, number>> = {}
  const sizes = allFigures.map((figure) => {
    const { name, table = '', drawn, em } = figure
    const sides = drawn.length === 2 ? 'both' : drawn[0].side
    tables[table] = { ...tables[table], [sides]: (tables[table]?.[sides] ?? 0) + 1 }
    const { screen, print } = models.get(figure) as { screen: FigureModel; print: FigureModel }
    return {
      name,
      em,
      px: Number(pxPerMm(screen, 358).toFixed(3)),
      height: Number(screen.frame[3].toFixed(1)),
      print: Number(print.frame[2].toFixed(1)),
    }
  })
  const range = (key: 'em' | 'px' | 'height' | 'print') => {
    const sorted = [...sizes].sort((a, b) => a[key] - b[key])
    return [sorted[0], sorted[sorted.length - 1]].map((s) => [s.name, s[key]])
  }
  expect({ figures: sizes.length, tables }).toEqual({
    figures: 607,
    // chamber only: a closed front, or a cartridge without its base values; cartridge only: a
    // chamber without them (VIII: 35 Blanc and 8 mm Blanc; 35 R Blanc draws both)
    tables: {
      I: { both: 214 },
      II: { both: 144, chamber: 2 },
      III: { both: 39, cartridge: 1 },
      IV: { both: 88, chamber: 7 },
      V: { both: 23, chamber: 6 },
      VII: { both: 55 },
      VIII: { both: 1, chamber: 8, cartridge: 2 },
      IX: { chamber: 4 },
      X: { both: 9, chamber: 4 },
    },
  })
  // text size in mm, screen px per mm at 390 px, screen height and print width in mm
  expect({
    em: range('em'),
    px: range('px'),
    height: range('height'),
    print: range('print'),
  }).toMatchSnapshot()
})

it('dimensions every stored symbol or lists it as undimensioned', () => {
  // `<side>: <symbol>`, table VII apart, dimensioned on some figure or stored without a dimension
  const dimensioned = new Set<string>()
  const without = new Map<string, string[]>()
  for (const { name, values, table, variant, drawn } of allFigures)
    for (const { side, p } of drawn) {
      const kind = table === 'VII' ? `VII ${side}` : side
      const { dimensions, angles, radii } = p.annotation
      const marked = new Set([...dimensions, ...angles, ...radii].map((d) => d.symbol))
      for (const symbol of marked) dimensioned.add(`${kind}: ${symbol}`)
      for (const v of values) {
        const key = `${kind}: ${v.symbol}`
        if (v.side !== side || v.value === undefined || (v.variant && v.variant !== variant))
          continue
        if (!marked.has(v.symbol))
          without.set(key, [...new Set([...(without.get(key) ?? []), name])])
      }
    }
  const never = new Map<string, string[]>()
  for (const key of without.keys()) {
    if (dimensioned.has(key)) continue
    const [kind, symbol] = key.split(': ')
    never.set(kind, [...(never.get(kind) ?? []), symbol].sort())
  }
  // Reviewed: not dimensioned because no drawn feature carries them (such as L3+G, L4, L5, Q, Z)
  // or because they are the bore (table VII chamber B where it equals H)
  expect(
    Object.fromEntries([...never].map(([kind, symbols]) => [kind, symbols.join(', ')])),
  ).toMatchSnapshot()
  // the values tables mark exactly these stored values "not drawn": each is in the lists above
  const marked: string[] = []
  for (const record of current) {
    const list = recordFigures(record).filter((f) => f.drawn.length)
    if (!list.length) continue
    const drawnSides = new Set(list.flatMap((f) => f.drawn.map((d) => d.side)))
    for (const v of undimensionedValues(record.values, list)) {
      if (!drawnSides.has(v.side as Side) || v.value === undefined) continue
      const kind = record.table === 'VII' ? `VII ${v.side}` : v.side
      const names = without.get(`${kind}: ${v.symbol}`) ?? []
      if (!names.some((n) => n === record.id || n.startsWith(`${record.id} `)))
        marked.push(`${record.id} ${v.side} ${v.symbol}${v.variant ? ` ${v.variant}` : ''}`)
    }
  }
  expect(marked).toEqual([])
  // dimensioned on other figures, not on these (such as L1 and L2 where no shoulder is drawn)
  expect(
    Object.fromEntries(
      [...without]
        .filter(([key]) => dimensioned.has(key))
        .map(([key, names]) => [key, names.length]),
    ),
  ).toMatchSnapshot()
})
