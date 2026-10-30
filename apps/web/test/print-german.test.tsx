import { MantineProvider } from '@mantine/core'
import type { TrajectoryPoint } from '@open-reloading/core'
import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LadderTarget } from '../src/components/ladder-target.tsx'
import { LoadSheets } from '../src/components/load-sheets.tsx'
import { RangeCard } from '../src/components/range-card.tsx'
import { TargetPrint } from '../src/components/target-print.tsx'
import de from '../src/i18n/de.json'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { type Translator, translator } from '../src/i18n/translate.ts'
import { frameOf } from '../src/lib/target-editor.ts'
import { presetUnits } from '../src/lib/units.ts'
import { replaceUntilStable } from './markup.ts'

const shown = vi.hoisted(() => ({ t: undefined as Translator | undefined }))

// the pages read the language through the hook and print into a portal of `body`, which a server
// render has neither of
vi.mock('../src/i18n/language.ts', () => ({
  useTranslation: () => shown.t,
}))
vi.mock('../src/components/print.ts', async (original) => ({
  ...(await original<typeof import('../src/components/print.ts')>()),
  usePortalBody: () => ({}),
}))
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (children: ReactNode) => children,
}))

const german = translator(de, 'de')
const english = translator()

/** The text a reader sees on the printed page. */
const printed = (language: Translator, node: ReactNode) => {
  shown.t = language
  const markup = renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
  return replaceUntilStable(
    replaceUntilStable(markup, /<style[^>]*>[\s\S]*?<\/style>/g),
    /<[^>]+>/g,
    ' ',
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/** English words of the printed pages' own text that no German page may keep. */
const englishWords =
  /\b(Printed|Step|Steps|Rounds|Loaded|Statistics|Scale|Notes|Velocity|At the range|Loading|Range card|Ladder target|Distance|Shots|Pressure signs|Date)\b/

beforeAll(() => {
  setShownLanguage('de')
  // the target sheet names `document.body` as its portal target
  vi.stubGlobal('document', { body: {} })
})
afterAll(() => {
  setShownLanguage('en')
  vi.unstubAllGlobals()
})

const steps = [
  {
    n: 1,
    label: '0',
    charge: '41,0 gr',
    pressure: '3500 bar (3400 bar to 3600 bar)',
    ofMax: '85 %',
    velocity: '2700 ft/s',
    flag: 'Modellhinweis',
  },
  { n: 2, label: '+1', charge: '41,5 gr', pressure: '3600 bar (3500 bar to 3700 bar)' },
]
const components: [string, string][] = [
  ['Patrone', '.308 Winchester'],
  ['Geschoss', 'Beispiel, 168 gr'],
]

describe('the load sheets', () => {
  const sheet = (by?: 'overallLength' | 'temperature') => (
    <LoadSheets title="Beispiel" components={components} steps={steps} by={by} note="Hinweis." />
  )
  const sheets = (language: Translator, by?: 'overallLength' | 'temperature') =>
    printed(language, sheet(by))
  /** The column headers of the overview's steps table. */
  const heads = (language: Translator, by?: 'overallLength' | 'temperature') => {
    shown.t = language
    const markup = renderToStaticMarkup(<MantineProvider>{sheet(by)}</MantineProvider>)
    const thead = /<table class="sheet-table sheet-steps"><thead>([\s\S]*?)<\/thead>/.exec(markup)
    return [...(thead?.[1] ?? '').matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1])
  }

  it('are in German under the German setting, the overview and a page per charge', () => {
    const page = sheets(german)
    expect(page).toContain('Gedruckt am')
    expect(page).toContain('Treibladungen')
    expect(page).toContain('Streukreis')
    expect(page).toContain('Stufe 0, Hauptstufe: 41,0 gr')
    expect(page).toContain('Simulierter Gasdruck 3500 bar')
    expect(page).toContain('Auf dem Schießstand')
    expect(page).toContain('Druckanzeichen')
    expect(page).toContain('Schuss')
    expect(page).not.toMatch(englishWords)
  })

  it('name the length a seating ladder seats by', () => {
    expect(sheets(german, 'overallLength')).toContain('Stufen nach COAL')
    expect(sheets(english, 'overallLength')).toContain('COAL steps')
  })

  it('lead the overview rows with the value the ladder varies, not the step', () => {
    expect(heads(english)[0]).toBe('Charge')
    expect(heads(english, 'overallLength')[0]).toBe('COAL')
    expect(heads(english, 'temperature')[0]).toBe('Powder temperature')
    expect(heads(german, 'temperature')[0]).toBe('Pulvertemperatur')
    expect(heads(english)).not.toContain('Step')
    expect(heads(german)).not.toContain('Schritt')
    expect(sheets(english)).toContain('41,0 gr main')
    expect(sheets(german, 'temperature')).toContain('Stufen nach Pulvertemperatur')
  })

  it('stay English under the English setting', () => {
    const page = sheets(english)
    expect(page).toContain('Charges')
    expect(page).toContain('Step 0, main: 41,0 gr')
    expect(page).not.toContain('Treibladungen')
  })
})

describe('the range card', () => {
  const moa = Math.PI / 180 / 60
  const point = {
    range: 91.44,
    time: 0.1234,
    velocity: 800,
    energy: 3000,
    height: -0.0254,
    elevationHold: moa,
    windageHold: -2 * moa,
  } as TrajectoryPoint
  const card = (language: Translator) =>
    printed(
      language,
      <RangeCard
        result={{
          bulletText: 'Beispiel, G7 0.250',
          zeroRange: 91.44,
          si: { muzzleVelocity: 800, temperature: 288.15 },
          manual: false,
          tablePoints: [point],
          windPerUnit: { mps: [0.5 * moa], mph: [0.2 * moa] },
          click: { value: moa / 4, unit: 'MOA' },
        }}
        system={presetUnits('us')}
        paper="a5"
      />,
    )

  it('is in German under the German setting, with the decimal comma', () => {
    const page = card(german)
    expect(page).toContain('Schusstafel: Beispiel, G7 0.250')
    expect(page).toContain('Gedruckt am')
    expect(page).toContain('Klickwert')
    expect(page).toContain('Höhenverstellung (MOA / Klicks)')
    expect(page).toContain('0,123')
    expect(page).not.toMatch(englishWords)
  })

  it('stays English under the English setting', () => {
    expect(card(english)).toContain('Range card: Beispiel, G7 0.250')
  })
})

describe('the target sheet', () => {
  const group: ShotGroup = {
    id: 'g1',
    name: 'Gruppe 1',
    colour: '#eb6834',
    distance: 100,
    shots: [
      { x: 0, y: 0, placement: 'placed' },
      { x: 0.01, y: 0, placement: 'placed' },
      { x: 0.005, y: 0.004, placement: 'placed', excluded: true },
    ],
  }
  const sheet = { references: [], groups: [group] } as unknown as TargetSheet
  const page = (language: Translator, framed = true) =>
    printed(
      language,
      <TargetPrint
        name="Scheibe"
        sheet={sheet}
        frame={framed ? frameOf(sheet) : undefined}
        box={{ x: 0, y: 0, w: 200, h: 200 }}
        still={() => null}
        system={presetUnits('metric-grams')}
        summary={{ load: 'Beispiel', velocities: ['800 m/s'] }}
        photoRef={() => {}}
        score={() => '95 (9,5), 1 X'}
      />,
    )

  it('is in German under the German setting', () => {
    const text = page(german)
    expect(text).toContain('Gedruckt am')
    expect(text).toContain('Laborierung: Beispiel.')
    expect(text).toContain('Maßstab')
    expect(text).toContain('Statistik (mm / mrad)')
    expect(text).toContain('2 + 1 ausgeschl.')
    expect(text).toContain('Geschwindigkeit, simuliert')
    expect(text).not.toMatch(englishWords)
  })

  it('says why a sheet without a reference has no scale', () => {
    expect(page(german, false)).toContain('Kein Maßstab: Das Foto hat keine Referenz.')
    expect(page(english, false)).toContain('No scale: the photo has no reference.')
  })
})

describe('the ladder target', () => {
  const sheet = (language: Translator) =>
    printed(language, <LadderTarget labels={['41,0 gr', '41,5 gr']} system={presetUnits('us')} />)

  it('is in German under the German setting, with the decimal comma', () => {
    const page = sheet(german)
    expect(page).toContain('Ladeleiter-Zielscheibe')
    expect(page).toContain('Gedruckt am')
    expect(page).toContain('Das Lineal misst 100 mm')
    expect(page).toMatch(/Markengröße [\d,]+ MOA \(\d+,\d mm\)/)
  })
})
