import type { UserRecord } from '@open-reloading/schema'

const saved = '2026-10-13T10:00:00.000Z'

export const valid: UserRecord = {
  kind: 'bullet',
  id: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  name: 'Valid design',
  saved,
  data: {
    origin: 'user',
    manufacturer: 'catalogue:example-a',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.8862 },
      base: { type: 'boat-tail' },
      ogive: { form: 'tangent' },
    },
  },
}

export const bad = {
  kind: 'bulletDesign',
  id: 'old-1',
  name: 'Old design',
  saved,
  data: 'not an object',
}

export const badSheet = {
  kind: 'targetSheet',
  id: 'old-2',
  name: 'Old sheet',
  saved,
  data: { photo: 'p1' },
}
