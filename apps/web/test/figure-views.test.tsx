import { MantineProvider } from '@mantine/core'
import type { FigureModel } from '@open-reloading/drawing/cartridge'
import { chamberOf, coalRange, previewDrawn } from '@open-reloading/drawing/seating'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { figureViews } from '../src/lib/figure-views.ts'
import { sheetRecord } from './records.ts'

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'drawing-font', className: '' }) }))
const { TechnicalDrawing } = await import('../src/components/technical-drawing.tsx')
const { CartridgeDrawing } = await import('../src/components/cartridge-drawing.tsx')

const record = (id: string) => drawable(sheetRecord(id))

/** The screen SVG's view box and style, and the transforms and outline of every part group. */
const placement = (svg: string) => ({
  svg: (svg.match(/<svg [^>]*>/) as RegExpMatchArray)[0].replace(/ data-[\w-]+="[^"]*"/g, ''),
  transforms: [...svg.matchAll(/<g transform="([^"]*)"/g)].map((m) => m[1]),
  cartridge: svg.match(/<path id="[^"]*-c" d="([^"]*)"/)?.[1],
})

// a rimless, a rimmed, a belted and a rebated case
const ids = [
  'cip-308-win-2008-09-23',
  'cip-30-30-win-2002-05-15',
  'cip-300-weath-mag-2002-05-15',
  'cip-458-socom-2021-11-09',
]

describe('hiding the dimensions keeps the outline in place', () => {
  for (const id of ids)
    it(`${id}: the workbench figure's Combined, Cartridge and Chamber views share frame, text size and outline`, () => {
      const spec = record(id)
      const chamber = chamberOf(spec.values)
      if (!chamber) throw new Error(`${id} has no chamber`)
      // the preview's bore runs out to the longest COAL of a 30 mm bullet, as a seated one does
      const range = coalRange(chamber, { diameter: 7.8, length: 30 })
      const drawn = previewDrawn(spec.values, spec.table, range[1] + 2)
      if ('missing' in drawn) throw new Error(`${id} misses ${drawn.missing}`)
      for (const unit of ['mm', 'in'] as const)
        for (const medium of ['screen', 'print'] as const) {
          const models = figureViews(spec, drawn, unit, undefined, medium)
          const views = (['combined', 'cartridge', 'chamber'] as const).map((view) => {
            const model = models[view]
            if (!model) throw new Error(`${id} has no ${view} view`)
            return {
              model,
              svg: renderToStaticMarkup(
                <TechnicalDrawing id="f" title={id} model={model} level={medium === 'print'} />,
              ),
            }
          })
          const [combined, ...sides] = views
          for (const { model, svg } of sides) {
            expect(model.frame).toEqual(combined.model.frame)
            expect(model.em).toBe(combined.model.em)
            expect(model.scale).toEqual(combined.model.scale)
            const [a, b] = [placement(svg), placement(combined.svg)]
            expect(a.svg).toBe(b.svg)
            expect(a.transforms).toEqual(b.transforms)
          }
          // the case outline itself is the same with and without its dimensions
          expect(placement(views[1].svg).cartridge).toBe(placement(combined.svg).cartridge)
          // the Cartridge view draws dimensions, Combined none
          expect(views[1].model.layers.cartridge?.labels.length).toBeGreaterThan(0)
          expect(combined.model.layers.cartridge?.labels ?? []).toEqual([])
        }
    })

  it("the cartridge designer's views draw one screen SVG, the same in each view", () => {
    const spec = record('cip-308-win-2008-09-23')
    const screen = (view: 'cartridge' | 'chamber' | 'combined') =>
      (
        renderToStaticMarkup(
          <MantineProvider>
            <CartridgeDrawing spec={spec} view={view} />
          </MantineProvider>,
        ).match(/<svg [^>]*screen-only[\s\S]*?<\/svg>/) as RegExpMatchArray
      )[0]
    expect(screen('cartridge')).toBe(screen('combined'))
    expect(screen('chamber')).toBe(screen('combined'))
  })
})

describe("the workbench card's Cartridge view", () => {
  const spec = record('cip-308-win-2008-09-23')
  const symbols = (labels: { text: string }[] | undefined) =>
    (labels ?? []).map((l) => l.text.split(' ')[0]).sort()

  it("draws the record page's dimensions with the seated COAL in place of L6, and CBTO", () => {
    const page = figureViews(spec, undefined, 'mm').cartridge?.layers.cartridge
    const seated = figureViews(spec, undefined, 'mm', { coal: 68.74, cbto: 52.74 }).cartridge
      ?.layers.cartridge
    const recordSymbols = symbols(page?.labels)
    expect(recordSymbols).toContain('L6')
    expect(symbols(seated?.labels)).toEqual(
      [...recordSymbols.filter((s) => s !== 'L6'), 'COAL', 'CBTO'].sort(),
    )
    // angles and radii stay as on the record page
    expect(seated?.labels.length).toBe((page?.labels.length ?? 0) + 1)
    expect(seated?.labels.map((l) => l.text)).toContain('COAL 68.74')
  })

  it('the level figure carries the same dimensions as the upright one, on screen', () => {
    const seated = { coal: 68.74, cbto: 52.74 }
    const level = figureViews(spec, undefined, 'mm', seated, 'print').cartridge
    const upright = figureViews(spec, undefined, 'mm', seated).cartridge
    expect(level?.medium).toBe('print')
    expect(symbols(level?.layers.cartridge?.labels)).toEqual(
      symbols(upright?.layers.cartridge?.labels),
    )
    const svg = renderToStaticMarkup(
      <TechnicalDrawing id="f" title="308" model={level as FigureModel} level />,
    )
    expect(svg).toMatch(/class="drawing [^"]*screen-only"/)
    expect(svg).toContain('data-level="true"')
    // level: the part is not turned
    expect(svg).not.toContain('rotate(-90)')
  })

  it('labels the seated COAL and CBTO in mm to 0.01 mm, without float noise', () => {
    const models = figureViews(spec, undefined, 'mm', { coal: 71.12, cbto: 55.120000000000005 })
    const texts = models.cartridge?.layers.cartridge?.labels.map((l) => l.text) ?? []
    expect(texts).toContain('COAL 71.12')
    expect(texts).toContain('CBTO 55.12')
  })

  it('in inches the COAL label is the entered length', () => {
    // 2.72 in, which 0.01 mm rounding would label 2.7201
    const models = figureViews(spec, undefined, 'in', { coal: 2.72 * 25.4 })
    expect(models.cartridge?.layers.cartridge?.labels.map((l) => l.text)).toContain('COAL 2.7200')
  })
})
