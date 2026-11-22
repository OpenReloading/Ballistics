import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { fromLabelStudio } from '../scripts/label-studio.mts'

it('converts a Label Studio export into a label set', () => {
  const exported = JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures', 'label-studio-export.json'), 'utf8'),
  )
  expect(fromLabelStudio(exported)).toEqual({
    photos: {
      'a.jpg': {
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        source: 'own photo',
        license: 'CC0-1.0',
        author: 'Test Labeler',
        session: '2026-05-02 range A',
        kind: 'printed',
        usable: true,
        complete: true,
        size: [400, 300],
        visibleDiameterPx: 12.5,
        holes: [
          { x: 100, y: 150, uncertain: false },
          { x: 300, y: 75, uncertain: true },
        ],
      },
      'b.jpg': {
        sha256: '60303ae22b998861bce3b28f33eec1be758a213c86c93c076dbe9f558c11c752',
        source: 'https://example.org/b.jpg',
        license: 'CC-BY-4.0',
        author: 'Another Author',
        session: '2026-05-09 range B',
        kind: 'reactive',
        usable: false,
        complete: false,
        size: [200, 200],
        visibleDiameterPx: 8,
        holes: [{ x: 100, y: 150, uncertain: false }],
      },
    },
  })
})
