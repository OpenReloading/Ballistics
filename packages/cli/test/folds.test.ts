import { describe, expect, it } from 'vitest'
import { foldsOf } from '../src/folds.ts'

describe('foldsOf', () => {
  it('deals the ids to the folds in the order of the SHA-256 of the salt, a slash and the id', () => {
    // digests start 0274, 5e10, 60d5, 8a8c, e5c8, efbb, fb65: the sixth and seventh wrap to folds 0 and 1
    const folds = foldsOf([
      '6-5-x-47-lapua',
      '308-win',
      '6mm-br',
      '30-06-spring',
      '6-5-creedmoor',
      '223-rem',
      '30-br',
      '308-win',
    ])
    expect(Object.fromEntries(folds)).toEqual({
      '30-06-spring': 0,
      '223-rem': 1,
      '6mm-br': 2,
      '308-win': 3,
      '30-br': 4,
      '6-5-creedmoor': 0,
      '6-5-x-47-lapua': 1,
    })
  })
})
