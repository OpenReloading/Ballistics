import { describe, expect, it } from 'vitest'
import { helpText } from '../src/components/directory-table.tsx'
import { trainingRowsHelp } from '../src/components/powder-list.tsx'
import de from '../src/i18n/de.json'
import { msg, translator } from '../src/i18n/translate.ts'
import { unfitTitles } from '../src/lib/burn-rate.ts'

describe('column help', () => {
  it('joins the messages of a help with a space, a single message as it is', () => {
    const { t } = translator()
    expect(helpText(msg('One.'), t)).toBe('One.')
    expect(helpText([msg('One.'), msg('Two.')], t)).toBe('One. Two.')
  })

  it("ends the Training rows help with the burn-rate page's no-fit sentence, in English and German", () => {
    for (const { t } of [translator(), translator(de, 'de')]) {
      const help = helpText(trainingRowsHelp, t)
      const reason = t(unfitTitles.none)
      expect(help.endsWith(` ${reason}`)).toBe(true)
      expect(help.startsWith(t(trainingRowsHelp[0]))).toBe(true)
    }
    expect(translator(de, 'de').t(unfitTitles.none)).toMatch(/^Keine angepassten Parameter/)
    expect(translator(de, 'de').t(trainingRowsHelp[0])).toMatch(/keine Bewertung\.$/)
  })
})
