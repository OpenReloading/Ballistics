import { describe, expect, it } from 'vitest'
import { helpText } from '../src/components/directory-table.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'

describe('column help', () => {
  it('joins the messages of a help with a space, a single message as it is', () => {
    const i18n = linguiOf('en')
    const one = { id: 'test.one', message: 'One.' }
    expect(helpText(one, i18n)).toBe('One.')
    expect(helpText([one, { id: 'test.two', message: 'Two.' }], i18n)).toBe('One. Two.')
  })
})
