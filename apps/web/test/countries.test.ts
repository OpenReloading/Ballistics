import { readdirSync, readFileSync } from 'node:fs'
import { hasFlag } from 'country-flag-icons'
import { describe, expect, it } from 'vitest'
import { flags } from '../src/components/countries.tsx'
import { countryOf, parseCountries } from '../src/lib/countries.ts'
import { defined } from './defined.ts'

const withoutFlag = new Set(['ussr', 'serbie and montenegro'])

const dir = new URL('../../../packages/data/records/cartridges/', import.meta.url)

describe('parseCountries', () => {
  it('split several and give their codes', () => {
    expect(parseCountries('Italy, Germany')).toEqual([
      { name: 'Italy', code: 'IT' },
      { name: 'Germany', code: 'DE' },
    ])
    // the records print some names in sentence case; each word starts upper case for display
    expect(parseCountries('United states')).toEqual([{ name: 'United States', code: 'US' }])
    expect(defined(parseCountries('Czech republic')[0]).name).toBe('Czech Republic')
    expect(defined(parseCountries('USSR')[0]).name).toBe('USSR')
    expect(defined(parseCountries('Serbie and Montenegro')[0]).name).toBe('Serbie and Montenegro')
    // a record that prints the code shows the country's name
    expect(parseCountries('US, IT')).toEqual([
      { name: 'United States', code: 'US' },
      { name: 'Italy', code: 'IT' },
    ])
  })

  it('give every country of the cartridge records a flag or list it as having none', () => {
    const names = new Set<string>()
    for (const f of readdirSync(dir)) {
      const { country } = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
        country?: string | undefined
      }
      if (country) for (const c of country.split(',')) names.add(c.trim())
    }
    expect(names.size).toBeGreaterThan(20)
    for (const name of names) {
      const { code } = defined(parseCountries(name)[0])
      // former states without a current flag are text only
      expect(code !== undefined || withoutFlag.has(name.toLowerCase()), name).toBe(true)
      if (code) expect(flags[code], name).toBeDefined()
    }
  })
})

describe('countryOf', () => {
  it('names the country of an ISO code, with the code of its flag', () => {
    expect(countryOf('FI')).toEqual({ name: 'Finland', code: 'FI' })
    expect(countryOf('AU')).toEqual({ name: 'Australia', code: 'AU' })
    expect(countryOf('GB').name).toBe('United Kingdom')
  })

  // the flags' codes, so the test runs while no bullet or powder record names a country
  const codes = new Set(Object.keys(flags))
  for (const kind of ['bullets', 'powders']) {
    const dir = new URL(`../../../packages/data/records/${kind}/`, import.meta.url)
    for (const f of readdirSync(dir)) {
      const { country } = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
        country?: string | undefined
      }
      if (country) codes.add(country)
    }
  }
  it('names every country code of the flags and the bullet and powder records and has its flag', () => {
    for (const code of codes) {
      expect(countryOf(code).name, code).not.toBe(code)
      expect(hasFlag(code), code).toBe(true)
      expect(flags[code], code).toBeDefined()
    }
  })
})
