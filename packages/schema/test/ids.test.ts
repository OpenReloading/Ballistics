import { describe, expect, it } from 'vitest'
import { parseRef, ref, userId } from '../src/index.ts'

const uuid = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'

describe('userId', () => {
  it('accepts a UUID and what crypto.randomUUID returns', () => {
    expect(userId.safeParse(uuid).success).toBe(true)
    expect(userId.safeParse(crypto.randomUUID()).success).toBe(true)
  })

  it('rejects a record id, a legacy browser id and an empty text', () => {
    for (const bad of ['308-win', 'lk3j2h1g-a8s7d6f5', '', `${uuid}x`])
      expect(userId.safeParse(bad).success).toBe(false)
  })
})

describe('ref', () => {
  const firearm = ref('firearm')

  it('accepts a catalogue reference with a record id and a user reference with a UUID', () => {
    expect(firearm.safeParse('catalogue:308-win').success).toBe(true)
    expect(firearm.safeParse(`user:${uuid}`).success).toBe(true)
  })

  it('rejects a missing or unknown scope, a user id that is no UUID and a bad catalogue id', () => {
    for (const bad of [
      '308-win',
      uuid,
      `other:${uuid}`,
      'user:308-win',
      'catalogue:Not Kebab',
      'catalogue:',
      `catalogue:${uuid}:x`,
    ])
      expect(firearm.safeParse(bad).success).toBe(false)
  })

  it('names the kind in its description', () => {
    expect(firearm.description).toContain('firearm')
  })

  it('parseRef splits the scope and the id', () => {
    expect(parseRef('catalogue:308-win')).toEqual({ scope: 'catalogue', id: '308-win' })
    expect(parseRef(`user:${uuid}`)).toEqual({ scope: 'user', id: uuid })
    expect(parseRef('308-win')).toBeUndefined()
  })
})
