import { MantineProvider } from '@mantine/core'
import { recordFigures } from '@open-reloading/drawing/cartridge'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CartridgeList } from '../src/components/cartridge-list.tsx'
import { CartridgeSides, RecordFacts, VariantMatrix } from '../src/components/cartridge-record.tsx'
import {
  combinedRows,
  inReadingOrder,
  pressureStripNote,
  pressureStripValues,
  variantMatrix,
} from '../src/lib/cartridge-record.ts'
import { packCartridges } from '../src/lib/cartridge-rows.ts'
import { drawable } from '../src/lib/cartridge-sheet.ts'
import { parseCountries } from '../src/lib/countries.ts'
import { type PresetId, presetUnits } from '../src/lib/units.ts'
import { defined, missing } from './defined.ts'
import { replaceUntilStable } from './markup.ts'
import { sheetRecord } from './records.ts'

// the units of the Settings, as a test sets them: `useUnits` reads this preset
const settings = vi.hoisted(() => ({ preset: 'metric-grams' as PresetId }))
vi.mock('../src/components/units-settings.tsx', async (original) => ({
  ...(await original<typeof import('../src/components/units-settings.tsx')>()),
  useUnits: () => ({
    choice: { preset: settings.preset, overrides: {} },
    system: presetUnits(settings.preset),
    choose: () => {},
    custom: undefined,
    ready: true,
  }),
}))

const html = (preset: PresetId, node: ReactNode) => {
  settings.preset = preset
  return renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
}
// the text a reader sees: no style rules, no hidden note descriptions
const text = (markup: string) => {
  const shown = replaceUntilStable(
    replaceUntilStable(markup, /<style[^>]*>[\s\S]*?<\/style>/g),
    /<span id="[^"]*" class="visually-hidden"[^>]*>[\s\S]*?<\/span>/g,
  )
  return replaceUntilStable(shown, /<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('the cartridge list row', () => {
  const row = {
    id: '308-win',
    name: '308 Win.',
    aliases: [],
    maxBulletDiameter: 7.85,
    caseLength: 51.18,
    cartridgeLength: 71.12,
    pmax: 4150,
    caseType: 'rimless' as const,
  }
  const facts = (preset: PresetId) =>
    html(preset, <CartridgeList packed={packCartridges([row])} />).match(
      /<span class="facts">(.*?)<\/span>/,
    )?.[1]

  it('puts the facts line under the name in the preset units', () => {
    expect(facts('metric-grams')).toBe('.308 · L3 51.18 mm · L6 71.12 mm · 4150 bar · rimless')
    expect(facts('us')).toBe('.308 · L3 2.015 in · L6 2.800 in · 60191 psi · rimless')
  })
})

describe('the cartridge record', () => {
  const c = sheetRecord('cip-308-win-2008-09-23')
  const strip = (preset: PresetId) => {
    const pressures = pressureStripValues(c)
    return html(
      preset,
      <RecordFacts
        values={pressures}
        notes={pressures.map((v) => pressureStripNote(v, c.table))}
        standard={{
          table: c.table,
          date: { label: c.revised ? 'Revised' : 'Published', value: c.revised ?? c.published },
          countries: c.country ? parseCountries(c.country) : undefined,
        }}
        // the API derives the case type from R1, P1 and R3
        build={{ caseType: 'rimless', method: c.pressureMethod }}
      />,
    )
  }

  it('shows the strip in the preset units: pressures, test barrel, standard, case and method', () => {
    const metric = strip('metric-grams')
    expect(metric.match(/class="fact-card"/g)).toHaveLength(4)
    expect(text(metric)).toBe(
      'Pmax bar 4150 PK bar 4773 PE bar 5190 M mm 25 EE J 3920 Table I Revised 2008-09-23 Country United States Case rimless Method transducer',
    )
    const us = text(strip('us'))
    expect(us).toMatch(/^Pmax psi 60191 PK psi 69227 .* M in \.9843 /)
  })

  it('heads the side tables with the limit in the length unit of the preset', () => {
    const sheet = drawable(c)
    const rows = inReadingOrder(combinedRows(c, recordFigures(sheet)))
    const heads = (preset: PresetId) => {
      const sides = html(
        preset,
        <CartridgeSides
          pairs={[{ cartridge: null, chamber: null }]}
          rows={rows}
          table={c.table}
          drawn={['cartridge', 'chamber']}
        />,
      )
      return [...sides.matchAll(/<th[^>]*scope="col"[^>]*>(.*?)<\/th>/g)].map(([, h = missing()]) =>
        text(h),
      )
    }
    expect(heads('metric-grams')).toEqual(['Symbol', 'Max (mm)', 'Symbol', 'Min (mm)'])
    expect(heads('us')).toEqual(['Symbol', 'Max (in)', 'Symbol', 'Min (in)'])
  })
})

describe('the Cal. 12 variants matrix', () => {
  const spec = sheetRecord('cip-12-2018-10-17')
  const { variants, rows } = variantMatrix(spec)
  const table = html(
    'metric-grams',
    <VariantMatrix variants={variants} rows={rows} labelledBy="record-variants" />,
  )
  const cells = (tag: 'th' | 'td', body: string) =>
    [...body.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map(
      ([, t = missing()]) => text(t),
    )
  const bodyRows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map(([, r]) => r)

  it('has a column per variant and a row per value, labelled with its unit', () => {
    expect(cells('th', table.match(/<thead[\s\S]*<\/thead>/)?.[0] ?? '')).toHaveLength(10)
    expect(bodyRows.map((r) => cells('th', defined(r))[0])).toEqual([
      'Pmax (bar)',
      'PK (bar)',
      'PE (bar)',
      'M (mm)',
      'Cartridge l (mm)',
      'Chamber L (mm)',
    ])
  })

  it('gives the pressure from the shortest to the longest variant and the text of M', () => {
    const pmax = cells('td', defined(bodyRows[0]))
    expect(pmax[0]).toBe('150')
    expect(pmax.at(-1)).toBe('1050')
    expect(cells('td', defined(bodyRows[3]))[1]).toBe('25/30')
  })

  it('keeps the Fe variants as rows of the chamber table, none for l', () => {
    const combined = combinedRows(spec, recordFigures(drawable(spec)))
    expect(combined.find((r) => r.symbol === 'Fe (bascule)')?.chamber).toBeDefined()
    expect(combined.some((r) => r.cartridge?.symbol === 'l')).toBe(false)
  })
})
