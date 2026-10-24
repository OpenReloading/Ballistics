import type { Bullet } from '@openreloading/schema'

/** Made-up bullet records for the tests; the numbers are not any manufacturer's. */
export const targetBullet: Bullet = {
  id: 'example-a-1001',
  manufacturer: 'example-a',
  productNumber: '1001',
  name: '30 Cal 168 gr Hybrid Target',
  productLine: 'Target',
  caliber: '.308',
  diameter: { value: 7.823 },
  mass: { value: 10.886 },
  length: { value: 32.0 },
  base: { length: { value: 5.5 } },
  noseLength: { value: 20.0 },
  baseToOgive: { value: 14.0 },
  bearingLength: { value: 6.5 },
  ballisticCoefficients: [
    { dragModel: 'G1', value: 0.5 },
    { dragModel: 'G7', value: 0.25, note: 'G7 form factor 0.960' },
  ],
  recommendedTwist: { value: 304.8, raw: '1:12"' },
  note: 'A made-up record.',
  provenance: {
    kind: 'published',
    sources: [
      {
        title: 'Example A catalog',
        url: 'https://example.com/catalog',
        retrieved: '2026-01-01',
        fields: [
          'diameter',
          'mass',
          'length',
          'base.length',
          'noseLength',
          'baseToOgive',
          'bearingLength',
          'ballisticCoefficients',
          'recommendedTwist',
        ],
      },
    ],
  },
}

/** A second made-up record: a boat tail with a secant ogive and a hollow point, no nose or bearing lengths. */
export const matchBullet: Bullet = {
  id: 'example-b-2002',
  manufacturer: 'example-b',
  productNumber: '2002',
  name: '30 Cal 168 gr BTHP Match',
  productLine: 'Match',
  caliber: '.308',
  diameter: { value: 7.823 },
  mass: { value: 10.886 },
  length: { value: 31.0 },
  base: { type: 'boat-tail' },
  ogive: { form: 'secant' },
  tip: { type: 'hollow-point' },
  ballisticCoefficients: [{ dragModel: 'G1', value: 0.45, note: 'Made up.' }],
  construction: {
    raw: 'jacket, swaged lead core',
    structure: 'cup-and-core',
    core: { material: 'lead' },
    jacket: {},
  },
  provenance: {
    kind: 'published',
    sources: [
      {
        title: 'Example B catalog',
        url: 'https://example.com/catalog-b',
        retrieved: '2026-01-01',
      },
    ],
  },
}
