import type { ShotGroup, TargetSheet } from '@rangefoundry/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { TargetCanvas } from '../src/components/target-canvas.tsx'
import { frameOf } from '../src/lib/target-editor.ts'

const group = (id: string): ShotGroup => ({
  id,
  name: id,
  colour: '#eb6834',
  distance: 100,
  shots: [
    { x: 0, y: 0, placement: 'placed' },
    { x: 0.01, y: 0.002, placement: 'placed' },
    { x: -0.004, y: 0.006, placement: 'placed' },
  ],
})
const sheet: TargetSheet = { references: [], targetRotation: 0, groups: [group('g1'), group('g2')] }

const noop = () => {}
const draw = (selected?: { group: string; index: number }) =>
  renderToStaticMarkup(
    <TargetCanvas
      sheet={sheet}
      frame={frameOf(sheet)}
      active="g1"
      selected={selected}
      tool="select"
      pending={[]}
      overlays={{
        spread: true,
        box: true,
        aim: true,
        ellipses: true,
        dispersion: true,
        axis: true,
        excluded: true,
        numbers: true,
        stats: false,
        rings: false,
      }}
      filter={{ contrast: 1, darken: 0 }}
      marker={undefined}
      describe={() => ''}
      onSelect={noop}
      onAdd={noop}
      onMove={noop}
      onToggle={noop}
      onDelete={noop}
      onNudge={noop}
      onPoint={noop}
      onRefMove={noop}
      onAimMove={noop}
    />,
  )

it('makes the selected shot of the active group its one tab stop, else the first', () => {
  const stops = (html: string) =>
    [...html.matchAll(/<circle[^>]*tabindex="0"[^>]*data-shot="([^"]+)"/g)].map((m) => m[1])
  expect(stops(draw())).toEqual(['g1 0'])
  expect(stops(draw({ group: 'g1', index: 2 }))).toEqual(['g1 2'])
})
