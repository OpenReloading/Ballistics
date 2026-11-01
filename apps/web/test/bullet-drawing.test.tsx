import { readFileSync } from 'node:fs'
import { readRecords } from '@open-reloading/data'
import { face } from '@open-reloading/drawing'
import {
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
  bulletSymbols,
  recordProfile,
} from '@open-reloading/drawing/bullet'
import type { Bullet } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { bullet } from '../../../packages/schema/src/index.ts'
import { type Laid, sideRules, textSize } from './drawing-rules.ts'

// next/font is compiled by Next; here the drawing font class is a fixed name
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'drawing-font', className: '' }) }))
const { TechnicalDrawing } = await import('../src/components/technical-drawing.tsx')

const records = readRecords().bundle.bullets as Bullet[]

/** No committed record has a polymer tip, and only an invented one a flat base: these two are test fixtures. */
const fixtures = ['bullet-flat-base', 'bullet-polymer-tip'].map(
  (f) => JSON.parse(readFileSync(new URL(`fixtures/${f}.json`, import.meta.url), 'utf8')) as Bullet,
)

/** The record's stored value of a field by its dot path. */
const stored = (r: Bullet, path: string) =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], r) as
    | { value: number }
    | undefined

/** One laid-out medium of a record's drawing, as the layout rules read it. */
function laid(r: Bullet, p: BulletProfile, medium: 'screen' | 'print') {
  const model = bulletFigureModel(p, medium, medium === 'screen' ? bulletScreenEm(p) : face.printEm)
  const side: Laid = {
    side: 'cartridge',
    p,
    layout: model.layers.bullet,
    axis: model.axis.bullet,
    em: model.em,
    // the bullet drawing prints mm to 2 decimals, inches to 4 (`labelText`)
    fixedDecimals: true,
    values: bulletSymbols.map((s) => ({
      side: 'cartridge' as const,
      symbol: s.symbol,
      quantity: 'length',
      value: stored(r, s.path)?.value,
    })),
  }
  return { model, side }
}

/** Draws the record under both media; its layout failures go to `failures`. False when it is refused. */
function checkRecord(
  r: (typeof records)[number],
  failures: string[],
  reasons: Map<string, number>,
): boolean {
  const p = recordProfile(r)
  if ('reason' in p) {
    if (r.length && p.reason === 'The record has no length.') failures.push(`${r.id} refused`)
    reasons.set(p.reason, (reasons.get(p.reason) ?? 0) + 1)
    return false
  }
  for (const medium of ['screen', 'print'] as const) layoutFailures(r, p, medium, failures)
  return true
}

function layoutFailures(
  r: (typeof records)[number],
  p: Parameters<typeof laid>[1],
  medium: 'screen' | 'print',
  failures: string[],
) {
  const { model, side } = laid(r, p, medium)
  for (const [name, rule] of Object.entries(sideRules))
    for (const f of rule(side)) failures.push(`${r.id} ${medium} ${name}: ${f}`)
  if (medium === 'screen') for (const f of textSize(model)) failures.push(`${r.id} ${f}`)
}

describe('bullet drawing over the records', () => {
  it('draws every record with a length or gives a reason, and passes every layout rule', () => {
    const failures: string[] = []
    let drawn = 0
    const reasons = new Map<string, number>()
    for (const r of records) if (checkRecord(r, failures, reasons)) drawn++
    expect(failures).toEqual([])
    // every record with a length draws; the rest have no length
    expect(drawn).toBe(records.filter((r) => r.length).length)
    const without = records.length - drawn
    expect([...reasons]).toEqual(without ? [['The record has no length.', without]] : [])
  })

  it('takes schema-valid fixtures for the flat base and the polymer tip', () => {
    for (const f of fixtures) expect(bullet.safeParse(f).error).toBeUndefined()
    expect(records.some((r) => r.tip?.type === 'polymer-tip')).toBe(false)
  })
})

/** The first record with a length of each maker, and every invented one: a golden file each (the other records draw and are checked above, without a file). Then the two fixtures. */
const makers = new Set<string>()
const sampled = records.filter((r) => {
  if (!r.length) return false
  if (r.manufacturer.startsWith('demo-')) return true
  if (makers.has(r.manufacturer)) return false
  makers.add(r.manufacturer)
  return true
})
const goldens = [...sampled, ...fixtures]

describe('bullet drawing markup', () => {
  for (const r of goldens)
    it(`${r.id} screen and print`, async () => {
      const p = recordProfile(r)
      if ('reason' in p) throw new Error(p.reason)
      for (const medium of ['screen', 'print'] as const) {
        const { model, side } = laid(r, p, medium)
        for (const rule of Object.values(sideRules)) expect(rule(side)).toEqual([])
        const svg = renderToStaticMarkup(
          <TechnicalDrawing id={`${r.id}-drawing`} title={r.id} desc={r.id} model={model} />,
        )
        expect(svg).toContain(`<title id="${r.id}-drawing-title">`)
        await expect(
          svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),
        ).toMatchFileSnapshot(`golden/bullet-${r.id}-${medium}.svg`)
      }
    })
})
