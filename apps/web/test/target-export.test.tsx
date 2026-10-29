import type { ShotGroup } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { extension, renderJob, StatsBlock } from '../src/components/target-export.tsx'
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

it('names a download file by the subtype of its MIME type', () => {
  expect(extension('image/jpeg')).toBe('jpg')
  expect(extension('image/png')).toBe('png')
  expect(extension('image/svg+xml')).toBe('svg')
  expect(extension('image/webp;q=1')).toBe('webp')
  expect(extension('')).toBe('img')
  expect(extension('image')).toBe('img')
})

it('a rendered image keeps the drawing, box, photo and file name of the sheet it was started on', () => {
  let sheet = 'A'
  const still = () => (
    <svg>
      <title>{sheet}</title>
    </svg>
  )
  const box = { x: 0, y: 0, w: 2000, h: 1000 }
  const photo = { url: 'blob:a', width: 2000, height: 1000 }
  const job = renderJob(still, box, photo, 0.5, 'sheet-a')
  // a switch to sheet B while the renderer loads
  sheet = 'B'
  expect(renderToStaticMarkup(job.svg)).toContain('<title>A</title>')
  expect(job).toMatchObject({ box, k: 2, photo, turn: 0.5, size: { w: 2000, h: 1000 } })
  expect(job.file).toBe('sheet-a-rendered.jpg')
  expect(renderJob(still, box, undefined, 0, 'drawn').file).toBe('drawn-rendered.png')
})
