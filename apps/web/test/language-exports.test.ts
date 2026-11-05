import { afterEach, describe, expect, it } from 'vitest'
import {
  canonicalNumberText,
  decimalMark,
  localizeDecimals,
  localizeNumber,
  plainNumber,
} from '../src/i18n/number.ts'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { readChrono, sessionCsv, sessionCsvBlob, sessionJsonBlob } from '../src/lib/chrono.ts'
import { countryName } from '../src/lib/countries.ts'
import { toCsv } from '../src/lib/csv.ts'
import { dateTimeText, dayText, monthText, timeText } from '../src/lib/dates.ts'
import { shareLink } from '../src/lib/share-link.ts'
import {
  exactFieldText,
  formatQuantity,
  inchText,
  lengthText,
  msText,
  percentText,
  presetUnits,
  shownLength,
  unitsOf,
  withUnit,
} from '../src/lib/units.ts'
import { userDataText } from '../src/lib/user-data.ts'

afterEach(() => setShownLanguage('en'))

/** Runs `make` with the language shown set to `language`. */
async function under<T>(language: string, make: () => T | Promise<T>) {
  setShownLanguage(language)
  try {
    return await make()
  } finally {
    setShownLanguage('en')
  }
}

const session = [
  'string,velocity,velocityUnit,coldBore,excluded',
  '"A, 41 gr",2795.5,fps,yes,',
  '"A, 41 gr",2810.25,fps,,',
  'B,2831,fps,,',
].join('\n')

describe('the language shown never changes what is exported', () => {
  it('gives the same session CSV and JSON', async () => {
    const data = await readChrono(new TextEncoder().encode(session), { fileName: 'a.csv' })
    const unit = unitsOf.velocity['ft/s']
    const english = sessionCsv(data, unit)
    const german = await under('de', () => sessionCsv(data, unit))
    expect(german).toBe(english)
    expect(english).toContain('2802.9')
    const [a, b] = [sessionCsvBlob(data, unit), await under('de', () => sessionCsvBlob(data, unit))]
    expect(await b.text()).toBe(await a.text())
    const [c, d] = [sessionJsonBlob(data), await under('de', () => sessionJsonBlob(data))]
    expect(await d.text()).toBe(await c.text())
  })

  it('copies a table of the screen as CSV with points', async () => {
    const cells = ['Charge', '2,40', '-0,5', '1,5 gr', '1,234 ms', '3185', '']
    const csv = (language: string) =>
      under(language, () => toCsv([cells.map((c) => canonicalNumberText(c))]))
    expect(await csv('de')).toBe('Charge,2.40,-0.5,1.5 gr,1.234 ms,3185,')
  })

  it('writes the same canonical field texts, the stored form of a link', async () => {
    const system = presetUnits('metric-grams')
    const text = () => [0.0024, 0.0254, 308].map((si) => exactFieldText('mass', system, si))
    expect(await under('de', text)).toEqual(text())
  })

  it('gives the same user data file and share link', async () => {
    const record = {
      kind: 'bullet',
      id: 'user:test',
      name: 'Test',
      data: { mass: { value: 10.9 }, diameter: { value: 7.82 } },
    } as never
    const files = (language: string) =>
      under(language, async () => ({
        file: userDataText([record]),
        link: await shareLink([record], '/bullets'),
      }))
    expect(await files('de')).toEqual(await files('en'))
  })
})

describe('numbers, dates and country names follow the language shown', () => {
  it('writes numbers, units and dates in the language shown by default', () => {
    const grains = presetUnits('metric-grains')
    const d = new Date(Date.UTC(2026, 4, 1, 13, 5, 9))
    setShownLanguage('de')
    expect([
      decimalMark(),
      localizeNumber('1.5'),
      localizeDecimals('2.5 g'),
      canonicalNumberText('2,5 g'),
      plainNumber(0.5),
      inchText('0,25', 'in'),
      formatQuantity('length', grains, 0.5e-3),
      withUnit('length', grains, 0.5e-3),
      msText(0.0012345),
      percentText(0.125),
      lengthText('travel', grains, 0.334621),
      shownLength('diameter', grains, 7.823e-3),
      dayText('2026-05-01'),
      monthText(0),
    ]).toEqual([
      ',',
      '1,5',
      '2,5 g',
      '2.5 g',
      '0,5',
      '0,25',
      '0,50',
      '0,50 mm',
      '1,235 ms',
      '12,5 %',
      '334,6',
      '7,82 mm',
      '1. Mai 2026',
      'Januar',
    ])
    expect(dateTimeText(d)).toBe(d.toLocaleString('de'))
    expect(timeText(d)).toBe(d.toLocaleTimeString('de'))
  })

  it('names a country through Intl except in English', () => {
    expect(countryName('Germany', 'DE', 'en')).toBe('Germany')
    expect(countryName('Germany', 'DE', 'de')).toBe('Deutschland')
    expect(countryName('Atlantis', undefined, 'de')).toBe('Atlantis')
  })
})
