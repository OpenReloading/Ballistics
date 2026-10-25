import type { Layout, LengthUnit } from '@open-reloading/drawing'
import { face } from '@open-reloading/drawing'
import {
  type FigureModel,
  figureModel,
  recordFigures,
  regions,
  screenEm,
  screenWidth,
} from '@open-reloading/drawing/cartridge'
import { describe, expect, it } from 'vitest'
import { defined, missing } from './defined.ts'
import {
  arrowheadsClear,
  extensionStarts,
  type Laid,
  leaderEnds,
  nonZero,
  type SpecRecord,
  sideRules,
  storedValues,
  textSize,
  verified,
} from './drawing-rules.ts'

/** Each drawn figure of a record with its screen and print models, as the page lays them out. */
function laidOut(record: SpecRecord, unit: LengthUnit = 'mm') {
  const shown = recordFigures(record).filter((f) => f.drawn.length)
  const em = screenEm(
    shown.map((f) => f.drawn),
    unit,
  )
  const across = Math.max(...shown.map((f) => screenWidth(f.drawn, em, unit)))
  const list = (n: number) => (n === 2 ? regions(record.values) : [])
  return shown.map(({ id, variant, drawn }) => ({
    id,
    variant,
    drawn,
    unit,
    // with the detail letters, as the page draws it
    screen: figureModel(drawn, 'screen', em, across, list(drawn.length), true, unit),
    print: figureModel(drawn, 'print', face.printEm, 0, list(drawn.length), false, unit),
  }))
}

const sides = (
  record: SpecRecord,
  f: ReturnType<typeof laidOut>[number],
  model: FigureModel,
): Laid[] =>
  f.drawn.map(({ side, p }) => ({
    side,
    p,
    layout: model.layers[side] as Layout,
    axis: model.axis[side] as [number, number],
    em: model.em,
    values: record.values,
    variant: f.variant,
    unit: f.unit,
  }))

describe('layout rules on a broken layout', () => {
  const cartridge = (id: string) => {
    const record = verified.find((r) => r.id === id) as SpecRecord
    const figure = defined(laidOut(record)[0])
    return { figure, laid: sides(record, figure, figure.screen)[0] }
  }
  const { figure = missing(), laid: base = missing() } = cartridge('cip-9-mm-luger-2008-09-23')
  const fresh = () => structuredClone(base)

  it('passes the 9 mm Luger cartridge as drawn', () => {
    for (const rule of Object.values(sideRules)) expect(rule(base)).toEqual([])
    expect(textSize(figure.screen)).toEqual([])
  })

  it('finds a value text that differs from the stored value', () => {
    const laid = fresh() as Laid
    const l = laid.layout.labels.find((x) => x.owner === 'L3') as Layout['labels'][number]
    l.text = l.text.replace(/\d$/, (d) => String((Number(d) + 1) % 10))
    expect(storedValues(laid)).toEqual([expect.stringMatching(/^L3 text/)])
  })

  it('finds an extension line starting off the outline', () => {
    const laid = fresh() as Laid
    const s = laid.layout.segs.find(
      (x) => x.owner === 'L3' && x.kind === 'thin',
    ) as Layout['segs'][number]
    s.a = [s.a[0], s.a[1] + 2]
    expect(extensionStarts(laid)).toEqual([expect.stringMatching(/^L3 extension line/)])
  })

  it('finds an extension line starting past the drawn axis', () => {
    const laid = fresh() as Laid
    const s = laid.layout.segs.find(
      (x) => x.owner === 'L3' && x.kind === 'thin',
    ) as Layout['segs'][number]
    s.a = [laid.axis[1] + 2, face.extensionGap]
    expect(extensionStarts(laid)).toEqual([expect.stringMatching(/^L3 extension line/)])
  })

  it('finds a zero-length dimension', () => {
    const laid = fresh() as Laid
    const d = laid.p.annotation.dimensions.find((x) => x.kind === 'chain') as {
      to: number
      from: number
    }
    d.to = d.from
    const span = defined(laid.layout.spans[0])
    span.length = 0
    expect(nonZero(laid)).toHaveLength(2)
  })

  it('finds a leader that does not reach its text', () => {
    const { laid = missing() } = cartridge('cip-284-win-2005-05-25')
    expect(leaderEnds(laid)).toEqual([])
    const s = laid.layout.segs.find((x) => x.leader) as Layout['segs'][number]
    s.b = [s.b[0] + 3 * laid.em, s.b[1] + 3 * laid.em]
    expect(leaderEnds(laid)).toEqual([expect.stringMatching(/leader ends/)])
  })

  it('finds an arrowhead on a text and on another arrowhead', () => {
    const laid = fresh() as Laid
    const t = defined(laid.layout.arrowheads[0])
    const l = laid.layout.labels.find((x) => x.owner !== t.owner) as Layout['labels'][number]
    t.at = l.c
    expect(arrowheadsClear(laid)).toContainEqual(expect.stringMatching(/arrowhead on .* text/))
    const other = fresh() as Laid
    const a = defined(other.layout.arrowheads[0])
    const b = other.layout.arrowheads.find(
      (x) => x.owner !== a.owner,
    ) as Layout['arrowheads'][number]
    b.at = a.at
    b.dir = a.dir
    expect(arrowheadsClear(other)).toContainEqual(
      expect.stringMatching(/arrowhead on .* arrowhead/),
    )
  })

  it('finds text under the minimum size', () => {
    expect(textSize({ ...figure.screen, em: figure.screen.em / 2 })).toHaveLength(2)
  })
})

const unitNote = (unit: LengthUnit) => (unit === 'mm' ? 'Dimensions in mm' : 'Dimensions in inches')

/** The layout failures of one figure of `record` in both media, labels in `unit`. */
function figureFailures(
  record: SpecRecord,
  f: ReturnType<typeof laidOut>[number],
  unit: LengthUnit,
): string[] {
  const failures: string[] = []
  for (const medium of ['screen', 'print'] as const) {
    if (f[medium].scale.note !== unitNote(unit)) failures.push(`${f.id} ${medium} unit note`)
  }
  for (const x of textSize(f.screen)) failures.push(`${f.id} screen ${x}`)
  for (const medium of ['screen', 'print'] as const)
    for (const laid of sides(record, f, f[medium]))
      for (const [name, rule] of Object.entries(sideRules))
        for (const x of rule(laid)) failures.push(`${f.id} ${laid.side} ${medium} ${name}: ${x}`)
  return failures
}

/** The layout failures of every verified record at both widths, labels in `unit`. */
function verifiedFailures(unit: LengthUnit): string[] {
  return verified.flatMap((record) =>
    laidOut(record, unit).flatMap((f) => figureFailures(record, f, unit)),
  )
}

describe('verified records', () => {
  it('are 33', () => {
    expect(verified).toHaveLength(33)
  })

  // 46 figures in two media and two widths: about 6 s on a CI runner
  it.each(['mm', 'in'] as const)(
    'pass every layout rule in both media at 390 and 1280 px, labels in %s',
    (unit) => {
      const failures = verifiedFailures(unit)
      expect(failures).toEqual([])
    },
    60_000,
  )
})
