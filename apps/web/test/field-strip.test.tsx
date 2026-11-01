import { MantineProvider } from '@mantine/core'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FieldStrip } from '../src/components/field-strip.tsx'
import { bulletStrip } from '../src/lib/record-fields.ts'
import { verbatim } from '../src/lib/wording.ts'
import { targetBullet } from './fixtures/bullets.ts'

const render = (props: ComponentProps<typeof FieldStrip>) =>
  renderToStaticMarkup(
    <MantineProvider>
      <FieldStrip {...props} />
    </MantineProvider>,
  )
const mass = bulletStrip(targetBullet).filter((i) => i.icon === 'mass')

it('shows nothing without items, a country or tags', () => {
  expect(render({ items: [] })).not.toContain('fact-cards')
})

it('writes each value in the units of the Settings with the other units beside it', () => {
  const html = render({ items: mass })
  // the server render's units are metric with grains; 10.886 g is 168.0 gr
  expect(html).toContain('<dd data-unit="gr">')
  expect(html).toContain('data-a="10.89" data-b="168.0"')
  expect(html).toContain('<span class="fact-number">168.0</span>')
  expect(html).not.toContain('Country')
})

it('adds the country of the manufacturer, then each tag, also two that read the same', () => {
  const html = render({
    items: [],
    country: { name: 'Germany', code: 'DE' },
    tags: [verbatim('Target'), verbatim('Target')],
  })
  expect(html).toContain('Country of the manufacturer')
  expect(html).toContain('Germany')
  expect(html.match(/mantine-Badge-label">Target</g)).toHaveLength(2)
  expect(html.indexOf('Germany')).toBeLessThan(html.indexOf('fact-tags'))
})

it('puts items with one icon in one card and names the velocity band of a coefficient', () => {
  const html = render({
    items: bulletStrip({
      ...targetBullet,
      ballisticCoefficients: [
        { dragModel: 'G1', value: 0.5, minVelocity: { value: 600 } },
        { dragModel: 'G7', value: 0.25 },
      ],
    }).filter((i) => i.icon === 'ballisticCoefficient'),
  })
  expect(html.match(/class="fact-card"/g)).toHaveLength(1)
  // the server render's units: m/s
  expect(html).toContain('BC G1 from 600 m/s')
  expect(html).toContain('BC G7')
  expect(html).not.toContain('BC G7 from')
})
