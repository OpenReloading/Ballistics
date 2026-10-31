import { afterAll, describe, it } from 'vitest'
import {
  expectFace,
  expectHoles,
  firstChoices,
  measure,
  type PhotoKind,
  photoKinds,
  type Row,
} from './face-photos.ts'

// No other face shares its rings: every photo is sure. The skewed photo's light ring lines read as
// holes. Per photo the holes found of six and the proposals that are no hole.
const holes: Record<PhotoKind, [number, number]> = {
  whole: [6, 4],
  insert: [6, 2],
  zoom: [6, 3],
  corner: [6, 0],
  cut: [6, 0],
  skewed: [6, 15],
  poor: [6, 0],
}

describe('the 10 m air rifle face on the photos people take', () => {
  const rows: Row[] = []
  afterAll(() => console.log(`First choices by rings matched:\n${firstChoices(rows)}`))
  for (const kind of photoKinds)
    it(kind, async () => {
      const row = await measure('issf-10m-air-rifle', kind, 4.5)
      rows.push(row)
      expectFace(row, 22.75, true)
      expectHoles(row, ...holes[kind])
    })
})
