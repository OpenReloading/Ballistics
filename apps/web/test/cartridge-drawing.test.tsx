import { MantineProvider } from '@mantine/core'
import { recordFigures } from '@openreloading/drawing/cartridge'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { combinedRows } from '../src/lib/cartridge-record.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { sheetRecord } from './records.ts'

vi.mock('next/font/local', () => ({ default: () => ({ variable: 'drawing-font', className: '' }) }))
const { CartridgeDrawing } = await import('../src/components/cartridge-drawing.tsx')

/** Both sides as the record page draws them, one side, or the designer's figure (no side). */
const render = (file: string, side?: 'cartridge' | 'chamber' | 'designer', unit?: 'mm' | 'in') => {
  const spec = drawable(sheetRecord(file))
  const html = renderToStaticMarkup(
    <MantineProvider>
      {side === 'designer' ? (
        <CartridgeDrawing spec={spec} />
      ) : side ? (
        <CartridgeDrawing spec={spec} side={side} unit={unit} />
      ) : (
        <>
          <CartridgeDrawing spec={spec} side="cartridge" />
          <CartridgeDrawing spec={spec} side="chamber" />
        </>
      )}
    </MantineProvider>,
  )
  const all = (tag: string) =>
    [...html.matchAll(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'gs'))].map(([, t]) =>
      t.replace(/<[^>]+>/g, '').replaceAll('&#x27;', "'"),
    )
  return { html, captions: all('figcaption'), descs: all('desc') }
}

describe('CartridgeDrawing', () => {
  it('keeps the drawing conventions out of the caption and the values in the description', () => {
    for (const file of ['cip-308-win-2008-09-23', 'cip-22-long-shot-2000-06-07']) {
      const { html, captions, descs } = render(file)
      expect(html).not.toContain('caption-chamber')
      for (const caption of captions) {
        expect(caption).not.toContain('Simplified drawing')
        expect(caption).not.toContain('conventions')
        expect(caption).not.toContain('stub')
      }
      expect(descs[0]).toMatch(/^Technical drawing, full section about the axis\./)
    }
  })

  it('gives the steel band width in the length unit of the description', () => {
    const [mm] = render('cip-308-win-2008-09-23', 'chamber').descs
    const [inch] = render('cip-308-win-2008-09-23', 'chamber', 'in').descs
    expect(mm).toContain('marked 3 mm steel band')
    expect(inch).toContain('marked .1181 in steel band')
  })

  it('keeps the Cal. 12 angle limits in the description', () => {
    const { descs } = render('cip-12-2018-10-17', 'chamber')
    expect(descs[5]).toContain('alpha1 10.5° (max)')
  })

  it('prints both sides upright at one scale: 9 mm Luger life size, 308 Win. at 1:1.25', () => {
    const print = (file: string) => {
      const { html, captions } = render(file)
      const sizes = [
        ...html.matchAll(/drawing-print[^>]*style="width:([\d.]+)mm;height:([\d.]+)mm"/g),
      ]
      return { sizes: sizes.map(([, w, h]) => [Number(w), Number(h)]), captions }
    }
    const luger = print('cip-9-mm-luger-2008-09-23')
    const win = print('cip-308-win-2008-09-23')
    for (const { sizes } of [luger, win]) {
      expect(sizes).toHaveLength(2)
      for (const [w, h] of sizes) expect(h).toBeGreaterThan(w)
    }
    expect(luger.captions[0]).toContain('the drawing is life size (1:1)')
    expect(win.captions[1]).toContain('the drawing is at 1:1.25 (80 % of life size)')
  })

  it('fits the sides drawn in sections of their own to the window at one scale in either length unit (308 Win.)', () => {
    const sized = (side: 'cartridge' | 'chamber', unit?: 'mm' | 'in') => {
      const svg = render('cip-308-win-2008-09-23', side, unit).html.match(
        /<svg[^>]*screen-only[^>]*viewBox="[\d.-]+ [\d.-]+ ([\d.]+) [\d.]+"[^>]*style="([^"]+)"/,
      )
      // the room kept for the other length unit is each figure's own height
      expect(svg?.[2]).toMatch(/;min-width:max\(min\([\d.]+px, .*;min-height:calc\(max\(min\(/)
      return svg && [svg[1], svg[2].replace(/;min-(width|height):[^;]+/g, '')]
    }
    expect(sized('cartridge')).toBeDefined()
    expect(sized('chamber')).toEqual(sized('cartridge'))
    // a unit switch, or the Settings unit read after hydration, keeps the scale
    for (const side of ['cartridge', 'chamber'] as const)
      expect(sized(side, 'in')).toEqual(sized('cartridge'))
  })

  it('flags the chamber notes of 32-40 Win. with the numbers of its caption', () => {
    // the screen drawing only: the print one repeats the flags
    const flags = (side: 'cartridge' | 'chamber') => {
      const { html } = render('cip-32-40-win-2002-05-15', side)
      const screen = html.slice(0, html.indexOf('drawing-print'))
      return [...screen.matchAll(/<g class="flag">.*?<text[^>]*>(\d+)<\/text>/g)].map(([, n]) => n)
    }
    expect(flags('cartridge')).toEqual(['1'])
    expect(flags('chamber')).toEqual(['2', '3', '4'])
    // each figure's caption numbers all four notes
    for (const side of ['cartridge', 'chamber'] as const) {
      const { html } = render('cip-32-40-win-2002-05-15', side)
      const caption = html.slice(html.indexOf('<figcaption'), html.indexOf('</figcaption>'))
      expect([...caption.matchAll(/class="note-flag"[^>]*>(\d+)</g)].map(([, n]) => n)).toEqual([
        '1',
        '2',
        '3',
        '4',
      ])
    }
  })

  /** The value texts of the screen drawing of a side. */
  const texts = (file: string, side: 'cartridge' | 'chamber', unit?: 'mm' | 'in') => {
    const { html } = render(file, side, unit)
    const screen = html.slice(0, html.indexOf('drawing-print'))
    return [...screen.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t)
  }

  it('labels L3 65 on the belted 308 Norma Mag. cartridge', () => {
    expect(texts('cip-308-norma-mag-2016-10-18', 'cartridge')).toContain('L3 65')
  })

  it('labels the 308 Win. figures in the length unit, angles in degrees', () => {
    expect(texts('cip-308-win-2008-09-23', 'cartridge')).toContain('L3 51.18')
    expect(texts('cip-308-win-2008-09-23', 'chamber')).toContain('L3 51.44')
    expect(render('cip-308-win-2008-09-23', 'cartridge').html).toContain('Dimensions in mm')
    const inches = texts('cip-308-win-2008-09-23', 'cartridge', 'in')
    expect(inches).toContain('L3 2.0150')
    expect(inches.find((t) => t.startsWith('α '))).toMatch(/°/)
    expect(texts('cip-308-win-2008-09-23', 'chamber', 'in')).toContain('L3 2.0252')
    const { html, descs, captions } = render('cip-308-win-2008-09-23', 'cartridge', 'in')
    expect(html).toContain('Dimensions in inches')
    expect(html).not.toContain('Dimensions in mm')
    expect(descs[0]).toMatch(/L3 2\.0150 in/)
    for (const caption of captions) expect(caption).not.toContain('Simplified drawing')
  })

  it('names the derived e of 454 Casull in the description and draws no e dimension', () => {
    const { descs } = render('cip-454-casull-2015-05-19', 'cartridge')
    expect(descs[0]).toMatch(/e 0 mm \(derived, not dimensioned\)/)
    expect(texts('cip-454-casull-2015-05-19', 'cartridge').filter((t) => /^\(?e /.test(t))).toEqual(
      [],
    )
  })

  it('draws one 9 C.F. Mori hull with its cone diameter d2 8.4', () => {
    const { html } = render('cip-9-c-f-mori-2006-09-19', 'cartridge')
    expect(html.match(/<svg[^>]*screen-only/g)).toHaveLength(1)
    expect(texts('cip-9-c-f-mori-2006-09-19', 'cartridge')).toContain('∅d2 8.4')
  })

  it('draws the 22 Long Shot chamber only and names the closed front on both sides', () => {
    const cartridge = render('cip-22-long-shot-2000-06-07', 'cartridge')
    expect(cartridge.html).not.toContain('<svg')
    expect(cartridge.html).toContain('Cartridge not drawn.')
    expect(cartridge.html).toContain('its front is closed or crimped')
    const chamber = render('cip-22-long-shot-2000-06-07', 'chamber')
    expect(chamber.html).not.toContain('dims-cartridge')
    expect(texts('cip-22-long-shot-2000-06-07', 'chamber')).toContain('L3 20.45')
    expect(chamber.captions[0]).toContain('its front is closed or crimped')
    expect(chamber.captions.join(' ')).not.toContain('cartridge values')
  })

  it('draws Cal. 12 as nine variants per side, 12/70 with l 69.8 and L 69.9', () => {
    for (const side of ['cartridge', 'chamber'] as const) {
      const { html, captions } = render('cip-12-2018-10-17', side)
      expect(html.match(/<svg[^>]*screen-only/g)).toHaveLength(9)
      expect(captions.filter((c) => c.includes('Variant 12/70.'))).toHaveLength(1)
    }
    /** The texts of the screen drawing of variant 12/70. */
    const variant = (side: 'cartridge' | 'chamber') => {
      const { html } = render('cip-12-2018-10-17', side)
      const from = html.indexOf('Outline, CIP Cal. 12 (12/70)')
      const svg = html.slice(from, html.indexOf('</svg>', from))
      return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(([, t]) => t)
    }
    expect(variant('cartridge')).toContain('l 69.8')
    expect(variant('chamber')).toContain('L 69.9')
  })

  it('names the side whose base values are missing (30 Super Belt Riml. H&H, cartridge only)', () => {
    expect(render('cip-30-super-belt-riml-h-h-2002-05-15', 'cartridge').html).toContain('<svg')
    // that side's note alone, not the drawn side's notes
    expect(render('cip-30-super-belt-riml-h-h-2002-05-15', 'chamber').html).toMatch(
      /<\/style><p>Chamber not drawn: missing [^<.]+\.<\/p>$/,
    )
  })

  it("draws the designer's sides in one figure with the views and the region differences (308 Win.)", () => {
    const { html, descs } = render('cip-308-win-2008-09-23', 'designer')
    // both sides drawn: Combined first
    expect(html).toContain('data-view="combined"')
    const radios = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? []
    expect(radios.map((r) => r.match(/value="(\w+)"/)?.[1])).toEqual([
      'cartridge',
      'chamber',
      'combined',
    ])
    expect(html.match(/<svg[^>]*screen-only/g)).toHaveLength(1)
    expect(html).toContain('dims-combined')
    expect(html).toContain('caption-combined')
    expect(descs[0]).toMatch(
      / Combined view: both outlines and the gap between them, no dimensions; .*R1 \+0\.02 mm/,
    )
    // the record page has no switch
    expect(render('cip-308-win-2008-09-23').html).not.toContain('type="radio"')
  })

  /** The screen figures of a rendering, each svg's markup. */
  const screens = (html: string) =>
    [...html.matchAll(/<svg[^>]*screen-only[^>]*>[\s\S]*?<\/svg>/g)].map(([s]) => s)

  it('links the table rows of a side to its drawn dimensions by the stored symbol (308 Win.)', () => {
    const file = 'cip-308-win-2008-09-23'
    const spec = drawable(sheetRecord(file))
    const rows = combinedRows(spec, recordFigures(spec))
    const linked = { cartridge: 0, chamber: 0 }
    for (const side of ['cartridge', 'chamber'] as const) {
      const [svg] = screens(render(file, side).html)
      const drawn = (tag: string) =>
        new Set(
          [...svg.matchAll(new RegExp(`<${tag}[^>]*data-symbol="([^"]*)"`, 'g'))].map((m) => m[1]),
        )
      const [marks, labels] = [drawn('g'), drawn('text')]
      const symbols = new Set(rows.filter((r) => r[side]).map((r) => r.storedSymbol))
      // a dimension the table has no row for would mark nothing
      expect([...labels].filter((s) => !symbols.has(s))).toEqual([])
      // a drawn dimension is its lines and arrowheads (the mark) and its text
      expect([...marks].sort()).toEqual([...labels].sort())
      linked[side] = [...symbols].filter((s) => labels.has(s)).length
      // rows whose symbol the drawing does not show link nothing
      expect(svg).not.toMatch(/data-symbol="(Fe|delta L)"/)
    }
    // most rows of both sides are drawn
    expect(linked.cartridge).toBeGreaterThanOrEqual(18)
    expect(linked.chamber).toBeGreaterThanOrEqual(14)
  })

  it('draws the Cal. 12 variants at one scale: the axis runs from 1 mm behind the head to 2 mm past l', () => {
    const { html } = render('cip-12-2018-10-17', 'cartridge')
    const axis = (variant: string) => {
      const svg = screens(html).find((s) => s.includes(`Outline, CIP Cal. 12 (${variant})`)) ?? ''
      const scale = svg.match(/<g transform="scale\(([\d.]+)\)"/)?.[1]
      const end = svg.match(/<path class="axis" d="M-1 0H([\d.]+)"/)?.[1]
      return { scale: Number(scale), length: Number(end) + 1 }
    }
    const [short, long] = [axis('12/35 T'), axis('12/89')]
    expect(short.scale).toBeGreaterThan(0)
    expect(long.scale).toBe(short.scale)
    expect(short.length).toBe(35 + 3)
    expect(short.length / long.length).toBeCloseTo((35 + 3) / (88.7 + 3), 2)
  })
})
