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

// The insert card and the zoomed photo show only rings that the Z21 and Nr. 5 faces share: the
// face is offered with them. The 640 x 480 JPEG shows the holes 6 px across. Per photo the holes
// found of six and the proposals that are no hole.
const sure: Record<PhotoKind, boolean> = {
  whole: true,
  insert: false,
  zoom: false,
  corner: true,
  cut: true,
  skewed: true,
  poor: true,
}
const holes: Record<PhotoKind, [number, number]> = {
  whole: [5, 0],
  insert: [4, 0],
  zoom: [4, 0],
  corner: [5, 0],
  cut: [4, 0],
  skewed: [5, 0],
  poor: [2, 0],
}

describe('the 25 m precision pistol face on the photos people take', () => {
  const rows: Row[] = []
  afterAll(() => console.log(`First choices by rings matched:\n${firstChoices(rows)}`))
  for (const kind of photoKinds)
    it(kind, async () => {
      const row = await measure('issf-25m-precision-50m-pistol', kind, 9)
      rows.push(row)
      expectFace(row, 250, sure[kind])
      expectHoles(row, ...holes[kind])
    })
})
