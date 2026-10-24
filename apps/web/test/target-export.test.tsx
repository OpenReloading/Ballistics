import type { ShotGroup } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { StatsBlock } from '../src/components/target-export.tsx'
import { presetUnits } from '../src/lib/units.ts'

const group: ShotGroup = {
  id: 'g1',
  name: 'Group 1',
  colour: '#eb6834',
  distance: 100,
  shots: [
    { x: 0, y: 0, placement: 'placed' },
    { x: 0.01, y: 0, placement: 'placed' },
  ],
}

it('the statistics box of the exports gives angles in the correction unit of the settings', () => {
  const box = { x: 0, y: 0, w: 100, h: 100 }
  const markup = (preset: 'metric-grams' | 'us') =>
    renderToStaticMarkup(
      <svg>
        <title>Statistics</title>
        <StatsBlock groups={[group]} system={presetUnits(preset)} box={box} k={1} />
      </svg>,
    )
  // 10 mm at 100 m
  expect(markup('metric-grams')).toContain('0.10 mrad')
  expect(markup('metric-grams')).not.toContain('MOA')
  expect(markup('us')).toContain('0.34 MOA')
})
