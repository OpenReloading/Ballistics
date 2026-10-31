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

// Its rings stand in the ratios of three other faces: it is always offered with them. Per photo the
// holes found of six and the proposals that are no hole.
const holes: Record<PhotoKind, [number, number]> = {
  whole: [6, 0],
  insert: [5, 0],
  zoom: [5, 0],
  corner: [5, 0],
  cut: [5, 0],
  skewed: [6, 0],
  poor: [5, 0],
}

describe('the BDMP Nr. 1 100 m face on the photos people take', () => {
  const rows: Row[] = []
  afterAll(() => console.log(`First choices by rings matched:\n${firstChoices(rows)}`))
  for (const kind of photoKinds)
    it(kind, async () => {
      const row = await measure('bdmp-nr1-100m', kind, 7.62)
      rows.push(row)
      expectFace(row, 170, false)
      expectHoles(row, ...holes[kind])
    })
})
