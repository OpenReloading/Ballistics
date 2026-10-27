import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { translator } from '../src/i18n/translate.ts'
import { safety } from '../src/lib/safety.ts'
import { defined } from './defined.ts'

it('holds the Safety section of README.md, line for line', () => {
  const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')
  const section = defined(defined(readme.split('## Safety')[1]).split('\n## ')[0])
  const lines = section
    .split('\n')
    .map((l) =>
      l
        .replace(/^- /, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim(),
    )
    .filter((l) => l !== '')
  expect(lines).toEqual([safety.intro, ...safety.items, safety.outro])
})

describe('the German text', () => {
  const { t } = translator(de, 'de')
  const lines = [safety.intro, ...safety.items, safety.outro, safety.confirm, safety.binding]

  it('translates every line of the English text', () => {
    for (const line of lines) expect(t(line), line).not.toBe(line)
  })

  it('says "sicher" exactly where the English line says "safe"', () => {
    const count = (text: string, word: RegExp) => text.match(word)?.length ?? 0
    for (const line of lines)
      expect(count(t(line), /\bsicher/gi), line).toBe(count(line, /\bsafe(ty)?\b/gi))
  })
})
