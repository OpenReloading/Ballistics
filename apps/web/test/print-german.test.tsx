import { MantineProvider } from '@mantine/core'
import type { TrajectoryPoint } from '@open-reloading/core'
import type { Firearm, TargetSheet } from '@open-reloading/schema'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { presetUnits } from '../src/lib/units.ts'

// The printed pages render into `body` after mounting: here the portal is the page itself, the
// language is German, and the markup is read as text.
vi.mock('../src/i18n/language.ts', async () => {
  const { translator: make } = await import('../src/i18n/translate.ts')
  const catalogue = (await import('../src/i18n/de.json')).default
  const german = { chosen: 'de', ...make(catalogue, 'de') }
  return { useTranslation: () => german }
})
vi.mock('../src/components/print.ts', () => ({
  printAlone: () => {},
  usePortalBody: () => ({}),
  usePrintEvents: () => {},
}))
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (children: unknown) => children,
}))
vi.stubGlobal('document', { body: {} })

const { DataCard } = await import('../src/components/firearm-data-card.tsx')
const { LoadSheets } = await import('../src/components/load-sheets.tsx')
const { RangeCard } = await import('../src/components/range-card.tsx')
const { TargetPrint } = await import('../src/components/target-print.tsx')

const us = presetUnits('us')
const metric = presetUnits('metric-grams')

/** The text of the markup: tags dropped, soft hyphens and the spaces around them closed up. */
const textOf = (page: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{page}</MantineProvider>)
    .replace(/<[^>]*>/g, ' ')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')

/** English words that a German print must not keep (names and units are not among them). */
const english =
  /\b(Printed|Rounds|Velocity|Notes?|Step|Charges?|At the range|Date|Group size|Point of impact|Scope|Optics?|Shots|Distance|Statistics|Scale|Conditions|Sight height|Zero)\b/

beforeAll(() => setShownLanguage('de'))

describe('German prints', () => {
  const steps = [
    {
      n: 1,
      label: '-1',
      charge: '40,0 gr',
      pressure: '3950 bar (3700 bis 4200 bar)',
      ofMax: '95 %',
      velocity: '2650 ft/s',
      flag: 'über CIP Pmax',
    },
    {
      n: 2,
      label: '0',
      charge: '41,0 gr',
      pressure: '4000 bar',
      ofMax: '96 %',
      velocity: '2700 ft/s',
    },
  ]

  it('prints the load sheet: the overview and a page per charge', () => {
    const text = textOf(
      <LoadSheets
        title="308 Win., 168 gr, Powder X"
        components={[
          ['Patrone', '308 Win.'],
          ['Geschoss', '168 gr'],
        ]}
        steps={steps}
      />,
    )
    expect(text).toContain('Gedruckt am')
    for (const german of [
      'Ladungen',
      'Stufe',
      'Ladung',
      'Gasdruck (Spitze), simuliert (Bereich)',
      'Anteil am Max.',
      'Geschwindigkeit, simuliert',
      'Patronen',
      'Geschwindigkeit, gemessen',
      'Druckanzeichen, Notizen',
      'Stufe -1: 40,0 gr',
      'Stufe 0, Hauptstufe: 41,0 gr',
      'Simulierter Gasdruck (Spitze) 3950 bar',
      '(95 % des Höchstwerts)',
      'Beim Laden',
      'Gewichte der gedosierten Ladungen',
      'Auf dem Schießstand',
      'Streukreis',
      'Treffpunkt',
      'abgeflachtes oder verkratertes Zündhütchen',
      'Schuss',
      'Notizen',
    ])
      expect(text, german).toContain(german)
    expect(text).not.toMatch(english)
  })

  it('names the length a seating ladder varies', () => {
    const text = textOf(<LoadSheets title="Last" components={[]} by="CBTO" steps={steps} />)
    expect(text).toContain('Stufen von CBTO')
    expect(text).not.toContain('Stufen von Ladung')
  })

  const point = {
    range: 91.44,
    time: 0.1234,
    velocity: 800,
    energy: 3000,
    height: -0.0254,
    elevationHold: Math.PI / 180 / 60,
    windageHold: 0,
  } as TrajectoryPoint
  const range = {
    bulletText: 'Sample bullet',
    zeroRange: 91.44,
    si: {
      muzzleVelocity: 800,
      sightHeight: 0.04,
      temperature: 288.15,
      pressure: 101325,
      humidity: 0.5,
      windSpeed: 5,
      windFrom: Math.PI / 2,
    },
    manual: false,
    tablePoints: [point],
    windPerUnit: { mps: [0.0002], mph: [0.0001] },
    click: { value: Math.PI / 180 / 240, unit: 'MOA' as const },
  }

  it('prints the range card with German headings, facts and a decimal comma', () => {
    const text = textOf(<RangeCard result={range} system={us} paper="a6" />)
    for (const german of [
      'Schusstafel: Sample bullet',
      'Gedruckt am',
      'Mündungsgeschwindigkeit',
      'Einschießentfernung',
      'Visierhöhe',
      'Bedingungen',
      'Stationsluftdruck',
      'Luftfeuchte',
      'Höhenlage',
      'Wind',
      'aus 90',
      'Klickwert',
      'Entfernung (yd)',
      'Höhe (in)',
      'Höhenverstellung (MOA / Klicks)',
      'Seitenverstellung (MOA)',
      'Geschwindigkeit (ft/s)',
      'Energie (ft·lbf)',
      'Zeit (s)',
      'Wind je 1 m/s (MOA / Klicks)',
      'Notizen',
      '0,123',
    ])
      expect(text, german).toContain(german)
    expect(text).not.toContain('0.123')
    expect(text).not.toMatch(english)
  })

  it('prints the target sheet with its statistics', () => {
    const sheet: TargetSheet = {
      references: [],
      targetRotation: 0,
      groups: [
        {
          id: 'g1',
          name: 'Gruppe 1',
          colour: '#eb6834',
          distance: 100,
          excluded: undefined,
          shots: [
            { x: 0, y: 0, placement: 'placed' },
            { x: 0.01, y: 0.002, placement: 'placed' },
            { x: -0.004, y: 0.006, placement: 'placed' },
          ],
        } as TargetSheet['groups'][number],
      ],
    }
    const text = textOf(
      <TargetPrint
        name="Scheibe"
        sheet={sheet}
        frame={
          { toTarget: [1, 0, 0, 0, 1, 0, 0, 0, 1], toImage: [1, 0, 0, 0, 1, 0, 0, 0, 1] } as never
        }
        box={{ x: -50, y: -50, w: 100, h: 100 }}
        still={() => null}
        system={metric}
        summary={{ load: 'Patrone, Geschoss', velocities: ['800 m/s'] }}
        photoRef={() => {}}
      />,
    )
    for (const german of [
      'Gedruckt am',
      'Laborierung: Patrone, Geschoss.',
      'Statistik (mm / mrad)',
      'Gruppe',
      'Schüsse',
      'Entfernung',
      'Mittlerer Radius',
      'Geschwindigkeit, simuliert',
    ])
      expect(text, german).toContain(german)
    expect(text).not.toMatch(english)
  })

  it('prints the data card of a firearm', () => {
    const firearm = {
      origin: 'user',
      name: 'Büchse',
      twist: { value: 254 },
      twistHand: 'left',
      barrelLength: { value: 600 },
      roundCount: 1200,
      optics: [
        {
          id: 'o1',
          kind: 'scope',
          name: 'Zielfernrohr',
          minMagnification: 3.5,
          maxMagnification: 12,
          reticle: 'Absehen 4',
        },
      ],
      configurations: [
        {
          id: 'c1',
          name: '',
          mounts: [{ optic: 'o1', sightHeight: { value: 50 }, zeroRange: { value: 100000 } }],
        },
      ],
      active: 'c1',
    } as unknown as Firearm
    const text = textOf(<DataCard f={firearm} system={metric} opticName={() => 'Zielfernrohr'} />)
    for (const german of [
      'Lauflänge',
      'Drall, Länge je Umdrehung',
      '1:254 mm, links',
      'Schusszahl',
      'Optiken',
      'Klickwert',
      '3,5 bis 12x',
      'Konfiguration 1',
      '(aktiv)',
      'Visierhöhe',
      'Einschießentfernung',
      'Luftwiderstandsfaktor',
      'k. A.',
    ])
      expect(text, german).toContain(german)
    expect(text).not.toMatch(english)
    expect(text).toContain('Zielfernrohr')
  })

  it('carries no safety text and no notice', () => {
    const text = textOf(<LoadSheets title="Last" components={[]} steps={steps} />)
    expect(text).not.toMatch(/Sicherheit|sicher|Haftung/i)
  })
})
