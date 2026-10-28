import type { LoadNote, LoadNoteRule } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { english, translator } from '../src/i18n/translate.ts'
import { noteText } from '../src/lib/load-notes.ts'
import { presetUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')
const german = translator(de, 'de')
const name = (session: string) => (session === 'a' ? 'Alpha' : 'Beta')
const base = { session: 'b', earlier: 'a' }

// The core package exports the rules as a type only: this record lists every rule, so a new rule
// fails the typecheck until its notes are added here.
const notes = {
  powderLot: [
    { ...base, rule: 'powderLot', change: 'changed', now: 'P2', before: 'P1' },
    { ...base, rule: 'powderLot', change: 'missing', before: 'P1' },
    { ...base, rule: 'powderLot', change: 'missing' },
  ],
  primerLot: [
    { ...base, rule: 'primerLot', change: 'changed', now: 'R2', before: 'R1' },
    { ...base, rule: 'primerLot', change: 'missing', before: 'R1' },
    { ...base, rule: 'primerLot', change: 'missing' },
  ],
  caseLot: [
    { ...base, rule: 'caseLot', change: 'changed', now: 'C2', before: 'C1' },
    { ...base, rule: 'caseLot', change: 'missing', before: 'C1' },
    { ...base, rule: 'caseLot', change: 'missing' },
  ],
  seating: [
    { ...base, rule: 'seating', by: 'overallLength', now: 71.3, before: 70.8 },
    { ...base, rule: 'seating', by: 'baseToOgive', now: 60.3, before: 59.8 },
  ],
  velocity: [{ ...base, rule: 'velocity', now: 830, before: 800, spread: 5 }],
  roundCount: [{ ...base, rule: 'roundCount', now: 650, before: 400, threshold: 500 }],
} as const satisfies Record<LoadNoteRule, readonly LoadNote[]>

/** English words of the sentences that no German text of them keeps. */
const englishWords = /\b(is|was|has|had|and|set|rounds|recorded|velocity|firearm|lot|mean)\b/i

describe('load notes under the German setting', () => {
  for (const [rule, list] of Object.entries(notes)) {
    it(`words every ${rule} note in German`, () => {
      for (const n of list as readonly LoadNote[]) {
        const shown = noteText(n, name, metric, german.t)
        expect(shown, JSON.stringify(n)).not.toBe(noteText(n, name, metric, english.t))
        expect(shown, JSON.stringify(n)).not.toMatch(englishWords)
        expect(shown, JSON.stringify(n)).not.toMatch(/[{}]/)
        expect(shown).toContain(name(n.session))
      }
    })
  }
})
