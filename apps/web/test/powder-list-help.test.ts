import { describe, expect, it } from 'vitest'
import { helpText } from '../src/components/directory-table.tsx'
import { msg, translator } from '../src/i18n/translate.ts'

describe('column help', () => {
  it('joins the messages of a help with a space, a single message as it is', () => {
    const { t } = translator()
    expect(helpText(msg('One.'), t)).toBe('One.')
    expect(helpText([msg('One.'), msg('Two.')], t)).toBe('One. Two.')
  })
})
