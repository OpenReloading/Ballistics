import { describe, expect, it } from 'vitest'
import { cartridgeOptionText } from '../src/lib/standards.ts'

describe('cartridgeOption', () => {
  it('puts the standard before the aliases', () => {
    expect(
      cartridgeOptionText({
        name: '308 Win.',
        aliases: ['308 Winchester', '7,62 x 51'],
      }),
    ).toBe('308 Win., CIP (308 Winchester, 7,62 x 51)')
    expect(cartridgeOptionText({ name: 'X', aliases: [] })).toBe('X, CIP')
  })
})
