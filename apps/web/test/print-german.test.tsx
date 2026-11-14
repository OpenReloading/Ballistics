import { MantineProvider } from '@mantine/core'
import type { ShotGroup, TargetSheet } from '@rangefoundry/schema'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { LoadSheets } from '../src/components/load-sheets.tsx'
import { TargetPrint } from '../src/components/target-print.tsx'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { type Translator, translator } from '../src/i18n/translate.ts'
import { frameOf } from '../src/lib/target-editor.ts'
import { presetUnits } from '../src/lib/units.ts'
import { replaceUntilStable } from './markup.ts'

const shown = vi.hoisted(() => ({ t: undefined as Translator | undefined }))

// the pages read the language through the hook and print into a portal of `body`, neither of which a server render has
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

  it('name the length a seating ladder seats by', () => {
    expect(sheets(english, 'overallLength')).toContain('41,0 gr main')
    expect(sheets(english, 'overallLength')).not.toContain('Main charge')
    expect(sheets(english, 'overallLength')).toContain('COAL steps')
  })

  it('lead the overview rows with the value the ladder varies, not the step', () => {
    expect(heads(english)[0]).toBe('Charge')
    expect(heads(english, 'overallLength')[0]).toBe('COAL')
    expect(heads(english, 'temperature')[0]).toBe('Powder temperature')
    expect(heads(english)).not.toContain('Step')
    expect(heads(english)).toContain('Peak pressure, simulated (corner cases)')
    expect(sheets(english)).toContain('41,0 gr main')
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

  it('says why a sheet without a reference has no scale', () => {
    expect(page(english, false)).toContain('No scale: the photo has no reference.')
  })
})
