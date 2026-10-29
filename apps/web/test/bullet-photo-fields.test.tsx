import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DistanceField } from '../src/components/bullet-photo.tsx'
import { msg } from '../src/i18n/translate.ts'
import { presetUnits } from '../src/lib/units.ts'

const html = (text: string, si: number | undefined) =>
  renderToStaticMarkup(
    <MantineProvider>
      <DistanceField
        label={msg('Diameter, caliper (optional)')}
        system={presetUnits('metric-grams')}
        value={{ text, si }}
        onChange={() => {}}
      />
    </MantineProvider>,
  )

it('a zero or negative size says why the scale ignores it', () => {
  expect(html('0', 0)).toContain('must be greater than 0')
  expect(html('-2', -0.002)).toContain('must be greater than 0')
})

it('an empty or valid size shows no error', () => {
  expect(html('', undefined)).not.toContain('must be')
  expect(html('7.82', 0.00782)).not.toContain('must be')
})
