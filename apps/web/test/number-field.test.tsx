import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { NumberField } from '../src/components/number-field.tsx'
import { setShownLanguage } from '../src/i18n/shown.ts'
import type { FieldSpec } from '../src/lib/field-spec.ts'
import { presetUnits } from '../src/lib/units.ts'

const system = presetUnits('metric-grams')

const field = (spec: Omit<FieldSpec, 'key' | 'label'>, text: string) =>
  renderToStaticMarkup(
    <MantineProvider>
      <NumberField
        spec={{ key: 'x', label: 'Value', ...spec }}
        system={system}
        value={{ text, si: Number(text) }}
        onChange={() => {}}
        unit="none"
      />
    </MantineProvider>,
  )

const inputOf = (html: string) => /<input[^>]*>/.exec(html)?.[0] ?? ''

afterEach(() => setShownLanguage('en'))

describe('a number field under English', () => {
  it('is a number input for a signed quantity and shows the point', () => {
    const input = inputOf(field({ quantity: 'temperature' }, '12.5'))
    expect(input).toContain('type="number"')
    expect(input).toContain('value="12.5"')
  })

  it('is a text input that shows the point for an unsigned quantity', () => {
    expect(inputOf(field({ quantity: 'mass', min: 0 }, '2.5'))).toContain('value="2.5"')
  })
})

describe('a number field under German', () => {
  it('shows the decimal comma of the canonical text in a text input that takes both marks', () => {
    setShownLanguage('de')
    const unsigned = inputOf(field({ quantity: 'mass', min: 0 }, '2.5'))
    expect(unsigned).toContain('value="2,5"')
    expect(unsigned).not.toContain('type="number"')
    expect(unsigned).toContain('inputMode="decimal"')
    // a signed quantity is no native number input, which could not show the comma
    const signed = inputOf(field({ quantity: 'temperature' }, '-12.5'))
    expect(signed).toContain('value="-12,5"')
    expect(signed).not.toContain('type="number"')
    expect(signed).not.toContain('inputMode')
  })

  it('shows a twist with the comma', () => {
    setShownLanguage('de')
    expect(inputOf(field({ quantity: 'twist' }, '1:8.5'))).toContain('value="1:8,5"')
  })

  it('shows an integer unchanged', () => {
    setShownLanguage('de')
    expect(inputOf(field({ quantity: 'range', min: 0 }, '100'))).toContain('value="100"')
  })
})
