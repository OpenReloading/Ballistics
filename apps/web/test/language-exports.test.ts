import { afterEach, describe, expect, it } from 'vitest'
import { canonicalNumberText, formatNumber, localizeDecimals } from '../src/i18n/number.ts'
import { setShownLanguage } from '../src/i18n/shown.ts'
import { readChrono, sessionCsv, sessionCsvBlob, sessionJsonBlob } from '../src/lib/chrono.ts'
import { countryName } from '../src/lib/countries.ts'
import { toCsv } from '../src/lib/csv.ts'
import { dayText } from '../src/lib/dates.ts'
import { shareLink } from '../src/lib/share-link.ts'
import { exactFieldText, presetUnits, unitsOf } from '../src/lib/units.ts'
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
  it('writes decimals with a comma on screen under German, so the comparisons below are not vacuous', async () => {
    expect(await under('de', () => formatNumber(2795.5, 1))).toBe('2795,5')
    expect(formatNumber(2795.5, 1)).toBe('2795.5')
  })

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
    const cells = ['Charge', '2,40', '-0,5', '1,5 gr', '3185', '']
    const csv = (language: string) =>
      under(language, () => toCsv([cells.map((c) => canonicalNumberText(c))]))
    expect(await csv('de')).toBe('Charge,2.40,-0.5,"1,5 gr",3185,')
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

describe('dates and country names follow the language shown', () => {
  it('writes a day in the language and keeps English as it was', () => {
    expect(dayText('2026-05-01', 'en')).toBe('1 May 2026')
    expect(dayText('2026-05-01', 'de')).toBe('1. Mai 2026')
    expect(dayText('May 2026', 'de')).toBe('May 2026')
  })

  it('names a country through Intl except in English', () => {
    expect(countryName('Germany', 'DE', 'en')).toBe('Germany')
    expect(countryName('Germany', 'DE', 'de')).toBe('Deutschland')
    expect(countryName('Atlantis', undefined, 'de')).toBe('Atlantis')
  })

  it('swaps the points of server-written numeric text and leaves prose points', () => {
    expect(localizeDecimals('2.5 g, 0.308 in', 'de')).toBe('2,5 g, 0,308 in')
    expect(localizeDecimals('2.5 g, 0.308 in', 'en')).toBe('2.5 g, 0.308 in')
    expect(localizeDecimals('See section 2. Then 3', 'de')).toBe('See section 2. Then 3')
  })
})
