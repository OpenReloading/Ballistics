import { bulletDimensions, recordProfile } from '@open-reloading/drawing/bullet'
import type { Bullet } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { typedBullet } from '../src/lib/bullet.ts'

/** Synthetic name-only record: a table prints the name and the mass, no diameter and no length. */
const nameOnly: Bullet = {
  id: 'example-a-nameonly',
  manufacturer: 'example-a',
  name: 'Test 168',
  nameOnly: true,
  mass: { value: 10.886 },
  provenance: { kind: 'published', sources: [{ title: 'Test load table' }] },
}

it('gives no shape and names the diameter for a name-only bullet with a typed length', () => {
  const typed = typedBullet(nameOnly, { bulletLength: 31e-3 })
  expect(typed.length?.value).toBeCloseTo(31, 9)
  expect(bulletDimensions(typed)).toBeUndefined()
  expect(recordProfile(typed)).toEqual({
    reason: 'The record has no diameter.',
    fields: ['diameter'],
  })
})

it('seats the same bullet once a diameter is typed too', () => {
  const typed = typedBullet(nameOnly, { bulletLength: 31e-3, bulletDiameter: 7.823e-3 })
  expect(bulletDimensions(typed)).toMatchObject({
    diameter: expect.closeTo(7.823, 9),
    length: expect.closeTo(31, 9),
  })
})
