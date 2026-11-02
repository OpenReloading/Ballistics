import { describe, expect, it } from 'vitest'
import { bulletFigureModel, bulletScreenEm } from '../src/bullet/figure.ts'
import { type FigureModel, figureModel } from '../src/cartridge/figure.ts'
import type { recordFigures } from '../src/cartridge/figures.ts'
import { regions, regionText } from '../src/cartridge/regions.ts'
import * as face from '../src/core/face.ts'
import {
  arrowheadCorners,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segHitsBox,
} from '../src/core/geometry.ts'
import { figureFrame } from '../src/core/layout.ts'
import type { PartPoint } from '../src/core/section.ts'
import { labelText } from '../src/core/text.ts'
import type { Layout } from '../src/core/types.ts'
import { lengthText, scaleLength } from '../src/core/units.ts'
import { defined } from './defined.ts'
import { inchFigures, inchGapFailures } from './inch-figures.ts'
import { sheets } from './sheets.ts'

// Labels in inches: the geometry stays in mm, only the length texts change.

const current = sheets

describe('length texts', () => {
  it('prints mm as stored, inches to 4 decimals without a leading zero; angles and Rt/R as they are', () => {
    expect(lengthText(11.95)).toBe('11.95')
    expect(lengthText(11.95, 'in')).toBe('.4705')
    expect(lengthText(71.48, 'in')).toBe('2.8142')
    expect(labelText({ kind: 'diameter', symbol: 'R1', value: 11.95 }, 'in')).toBe(
      `${face.diameterSign}R1 .4705`,
    )
    expect(labelText({ kind: 'length', symbol: 'L6', value: 71.48, derived: true }, 'in')).toBe(
      '(L6 2.8142)',
    )
    expect(labelText({ kind: 'angle', symbol: 'alpha', value: 20 }, 'in')).toBe('α 20°')
    expect(labelText({ kind: 'radius', symbol: 'Rt/R', value: 0.55 }, 'in')).toBe('Rt/R 0.55')
    expect(
      regionText({ name: 'neck', values: [{ symbol: 'H2', value: -0.0254 }] } as never, 'in'),
    ).toBe('H2 −.0010 conflict')
  })

  it('prints fixed lengths (the bullet drawing) in mm to 2 decimals, rounded as the decimal text reads', () => {
    const fixed = (value: number, unit: 'mm' | 'in' = 'mm') =>
      labelText({ kind: 'length', symbol: 'L', value }, unit, true)
    expect(fixed(30.5)).toBe('L 30.50')
    expect(fixed(7.823)).toBe('L 7.82')
    // toFixed would give 31.77 and 2.67: the binary value is a hair below the midpoint
    expect(fixed(31.775)).toBe('L 31.78')
    expect(fixed(2.675)).toBe('L 2.68')
    expect(fixed(30.5, 'in')).toBe('L 1.2008')
    // the ratio and angles are not lengths
    expect(labelText({ kind: 'radius', symbol: 'Rt/R', value: 0.55 }, 'mm', true)).toBe('Rt/R 0.55')
    // not fixed: the value as stored
    expect(labelText({ kind: 'length', symbol: 'L', value: 30.5 })).toBe('L 30.5')
  })

  it('names the unit and gives the scale bar in it', () => {
    const mm = figureFrame([0, -5, 60, 5], 'screen', 2, 0)
    const inch = figureFrame([0, -5, 60, 5], 'screen', 2, 0, 'in')
    expect(mm.scale).toMatchObject({ note: 'Dimensions in mm', label: '2 mm', length: 2 })
    expect(inch.scale.note).toBe('Dimensions in inches')
    expect(inch.scale.label).toBe('.2 in')
    expect(figureFrame([0, -5, 60, 5], 'screen', 2, 90, 'in').scale.label).toBe('1 in')
    expect(figureFrame([0, -5, 60, 5], 'screen', 2, 60, 'in').scale.label).toBe('.5 in')
    expect(scaleLength(100, 'in')).toBe(1)
    expect(scaleLength(30, 'in')).toBe(0.5)
    expect(scaleLength(0, 'in')).toBe(0.1)
  })
})

type Shown = ReturnType<typeof recordFigures>[number]

/** What is wrong with one text of a layout: outside the frame, on another text, a line or an arrowhead. */
function labelFailures(
  what: (x: string) => string,
  layout: Layout,
  k: number,
  tips: { owner: string; corners: PartPoint[] }[],
  inside: (p: PartPoint) => boolean,
) {
  const failures: string[] = []
  const l = defined(layout.labels[k])
  const corners = labelCorners(l)
  if (!corners.every(inside)) failures.push(what(`${l.owner} text outside`))
  for (const m of layout.labels.slice(k + 1))
    if (boxesOverlap(l, m)) failures.push(what(`${l.owner} text overlaps ${m.owner}`))
  for (const s of layout.segs)
    if (s.owner !== l.owner && segHitsBox(s, l))
      failures.push(what(`${s.owner} line crosses ${l.owner} text`))
  for (const t of tips)
    if (t.owner !== l.owner && polygonsOverlap(t.corners, corners))
      failures.push(what(`${t.owner} arrowhead on ${l.owner} text`))
  return failures
}

/** What is wrong with the layers of one figure model in one medium. */
function mediumFailures(f: Shown, medium: string, model: FigureModel) {
  const failures: string[] = []
  if (model.scale.note !== 'Dimensions in inches') failures.push(`${f.id} note`)
  const [fx, fy, fw, fh] = model.frame
  const inside = ([x, y]: PartPoint) => {
    const [ox, oy] = medium === 'screen' ? [y, -x] : [x, y]
    return ox >= fx - 1e-6 && ox <= fx + fw + 1e-6 && oy >= fy - 1e-6 && oy <= fy + fh + 1e-6
  }
  for (const [side, layout] of Object.entries(model.layers) as [string, Layout][]) {
    const what = (x: string) => `${f.id} ${side} ${medium} ${x}`
    const tips = layout.arrowheads.map((t) => ({
      owner: t.owner,
      corners: arrowheadCorners(t),
    }))
    for (const k of layout.labels.keys())
      failures.push(...labelFailures(what, layout, k, tips, inside))
  }
  return failures
}

/** What is wrong with one figure of a record in inches: text size, frame, clearances, length texts. */
function figureFailures(record: (typeof current)[number], f: Shown, em: number, across: number) {
  const failures: string[] = []
  const list = f.drawn.length === 2 ? regions(record.values) : []
  const models: [string, FigureModel][] = [
    ['screen', figureModel(f.drawn, 'screen', em, across, list, true, 'in')],
    ['print', figureModel(f.drawn, 'print', face.printEm, 0, list, false, 'in')],
  ]
  const screen = defined(models[0])[1]
  for (const column of [358, 1120]) {
    const px = em * Math.min(face.pxPerMm, column / screen.frame[2])
    if (px < face.minTextPx - 1e-9) failures.push(`${f.id} text ${px} px at ${column}`)
  }
  for (const [medium, model] of models) failures.push(...mediumFailures(f, medium, model))
  // every length text in inches
  for (const { side, p } of f.drawn) {
    const texts = (screen.layers[side]?.labels ?? []).map((l) => l.text)
    for (const d of p.annotation.dimensions.filter((x) => !x.derived))
      if (!texts.includes(labelText(d, 'in'))) failures.push(`${f.id} ${side} ${d.symbol}`)
  }
  return failures
}

it('lays out every CIP figure in inches with its texts clear, inside the frame, at 11 px', () => {
  const failures: string[] = []
  for (const { record, f, em, across } of inchFigures)
    failures.push(...figureFailures(record, f, em, across))
  expect(failures).toEqual([])
}, 300_000)

it('keeps every text a gap from the others and every angle text off its own arc (print, in)', () => {
  // here, not in inch-gaps.test.ts: the sweep above already laid out the print models
  expect(inchGapFailures('print')).toEqual([])
}, 120_000)

it('dimensions a bullet in inches, the ratio Rt/R unchanged', () => {
  const p = {
    points: [
      [0, 0],
      [3.9, 0],
      [3.9, 20],
      [0, 31],
    ] as [number, number][],
    notes: [],
    annotation: {
      dimensions: [
        { kind: 'length' as const, symbol: 'L', value: 31, from: 0, to: 31 },
        { kind: 'diameter' as const, symbol: 'd', value: 7.82, from: 10, to: 10, radius: 3.91 },
      ],
      angles: [],
      radii: [],
      edges: [],
      conventions: [],
    },
    outline: { segments: [], points: [], notes: [] },
    undimensioned: [],
  } as unknown as Parameters<typeof bulletFigureModel>[0]
  const m = bulletFigureModel(p, 'screen', bulletScreenEm(p, 'in'), 0, 'in')
  expect(
    m.layers.bullet.labels.map((l) => l.text).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  ).toEqual(['L 1.2205', `${face.diameterSign}d .3079`])
  expect(m.scale.note).toBe('Dimensions in inches')
})
