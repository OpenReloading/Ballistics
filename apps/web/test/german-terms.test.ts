import { describe, expect, it } from 'vitest'
import table from '../src/i18n/german-terms.json'

const statuses = ['verified', 'decided', 'unverified']
const groups = ['components', 'measurements', 'procedures', 'target-shooting']
const terms = table.terms
const sourceIds = Object.keys(table.sources)

function dups(values: string[]): string[] {
  return values.filter((v, i) => values.indexOf(v) !== i)
}

describe('German term table', () => {
  it('has unique keys in kebab case and unique English terms', () => {
    expect(dups(terms.map((t) => t.key))).toEqual([])
    expect(dups(terms.map((t) => t.english))).toEqual([])
    for (const t of terms) expect(t.key, t.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('gives every row an allowed status and group and an English term', () => {
    for (const t of terms) {
      expect(statuses, t.key).toContain(t.status)
      expect(groups, t.key).toContain(t.group)
      expect(t.english.trim(), t.key).not.toBe('')
    }
  })

  it('lists each source document with its edition and page convention', () => {
    expect(sourceIds.length).toBeGreaterThan(0)
    for (const [id, s] of Object.entries(table.sources)) {
      expect(s.document, id).not.toBe('')
      expect(s.edition, id).not.toBe('')
      expect(s.pages, id).not.toBe('')
    }
  })

  it('cites known documents with a short place, never a passage', () => {
    const cites = terms.flatMap((t) => [...t.sources, ...t.candidates.flatMap((c) => c.sources)])
    for (const c of cites) {
      expect(sourceIds, c.doc).toContain(c.doc)
      expect(c.at.trim(), c.doc).not.toBe('')
      expect(c.at.length, c.at).toBeLessThanOrEqual(80)
    }
  })

  it('gives a verified row one German term and a source', () => {
    for (const t of terms.filter((r) => r.status === 'verified')) {
      expect(t.german?.trim(), t.key).toBeTruthy()
      expect(t.sources.length, t.key).toBeGreaterThan(0)
      expect(t.candidates, t.key).toEqual([])
    }
  })

  it('gives a decided row one of its at least two distinct, sourced candidates and a decision', () => {
    for (const t of terms.filter((r) => r.status === 'decided')) {
      expect(t.candidates.length, t.key).toBeGreaterThanOrEqual(2)
      expect(
        t.candidates.map((c) => c.german),
        t.key,
      ).toContain(t.german)
      expect(dups(t.candidates.map((c) => c.german)), t.key).toEqual([])
      for (const c of t.candidates) {
        expect(c.german.trim(), t.key).not.toBe('')
        expect(c.sources.length, `${t.key} ${c.german}`).toBeGreaterThan(0)
      }
      expect(t.decision, t.key).toMatch(/^Rule [a-e]: .+\.$/)
    }
  })

  it('marks an unverified row as accepted for 1.0, with a note on the search', () => {
    for (const t of terms.filter((r) => r.status === 'unverified')) {
      expect(t.candidates, t.key).toEqual([])
      expect(t.german === null || t.german.trim() !== '', t.key).toBe(true)
      expect(t.note, t.key).toMatch(/^Accepted as candidate for 1\.0/)
    }
  })
})
