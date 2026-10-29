import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { defined } from './defined.ts'

const calls = vi.hoisted(() => ({ n: 0 }))
vi.mock('@open-reloading/core', async (actual) => {
  const core = await actual<typeof import('@open-reloading/core')>()
  return {
    ...core,
    groupStatistics: (...a: Parameters<typeof core.groupStatistics>) => {
      calls.n++
      return core.groupStatistics(...a)
    },
  }
})

const { TargetCanvas } = await import('../src/components/target-canvas.tsx')
const { frameOf, withGroup } = await import('../src/lib/target-editor.ts')
const { groupStatisticsOf: statisticsOf } = await import('../src/lib/target-groups.ts')

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

beforeEach(() => {
  calls.n = 0
})

it('statistics are computed once per group object, again only for an edited group', () => {
  // groups of its own: a drawing of `sheet` in another test has computed those already
  const fresh: TargetSheet = { ...sheet, groups: [group('g1'), group('g2')] }
  const a = statisticsOf(defined(fresh.groups[0]))
  expect(statisticsOf(defined(fresh.groups[0]))).toBe(a)
  expect(calls.n).toBe(1)
  const edited = withGroup(fresh, 'g2', (g) => ({ ...g, name: 'renamed' }))
  expect(edited.groups[0]).toBe(fresh.groups[0])
  statisticsOf(defined(edited.groups[0]))
  statisticsOf(defined(edited.groups[1]))
  expect(calls.n).toBe(2)
})

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

it('a render of the canvas with the same sheet (a pointer move) computes no statistics', () => {
  draw()
  const first = calls.n
  expect(first).toBeLessThanOrEqual(sheet.groups.length)
  draw()
  draw()
  expect(calls.n).toBe(first)
})

it('makes the selected shot of the active group its one tab stop, else the first', () => {
  const stops = (html: string) =>
    [...html.matchAll(/<circle[^>]*tabindex="0"[^>]*data-shot="([^"]+)"/g)].map((m) => m[1])
  expect(stops(draw())).toEqual(['g1 0'])
  expect(stops(draw({ group: 'g1', index: 2 }))).toEqual(['g1 2'])
})
