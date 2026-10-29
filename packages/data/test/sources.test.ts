import type { SourceRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkSources, resolveRecord, sourceIndex } from '../src/sources.ts'

const book = { id: 'book', title: 'Rule book', sha256: 'a'.repeat(64) } as SourceRecord
const plain = { id: 'plain', title: 'Plain' } as SourceRecord

describe('resolveRecord', () => {
  it('passes a record that is no object and an entry that is no object through', () => {
    const errors: string[] = []
    const index = sourceIndex([])
    expect(resolveRecord('text', index, 'a.json', errors)).toBe('text')
    expect(resolveRecord({ provenance: { sources: [null] } }, index, 'a.json', errors)).toEqual({
      provenance: { sources: [null] },
    })
    expect(resolveRecord({ provenance: {} }, index, 'a.json', errors)).toEqual({ provenance: {} })
    expect(errors).toEqual([])
  })

  it('names a rule book that is no source record id', () => {
    const errors: string[] = []
    const out = resolveRecord({ ruleBooks: [7, 'book'] }, sourceIndex([book]), 'f.json', errors)
    expect(errors).toEqual(['f.json: ruleBooks.0: name a source record by id'])
    expect(out).toEqual({
      ruleBooks: [
        7,
        { title: 'Rule book', edition: undefined, url: undefined, sha256: book.sha256 },
      ],
    })
  })
})

describe('checkSources', () => {
  it('asks a record to cite the source record whose SHA-256 it embeds', () => {
    const errors: string[] = []
    const index = sourceIndex([book, plain])
    const embedded = { provenance: { sources: [{ title: 'Copy', sha256: book.sha256 }] } }
    resolveRecord(embedded, index, 'a.json', errors)
    const cited = { provenance: { sources: [{ source: 'book' }, { source: 'plain' }] } }
    resolveRecord(cited, index, 'b.json', errors)
    checkSources(index, errors)
    expect(errors).toEqual(['a.json: cite source record "book" by id'])
  })

  it('keys an embedded source without SHA-256 by title and URL, a missing URL as empty', () => {
    const errors: string[] = []
    const index = sourceIndex([])
    const record = { provenance: { sources: [{ title: 'Table' }] } }
    resolveRecord(record, index, 'a.json', errors)
    resolveRecord(record, index, 'b.json', errors)
    checkSources(index, errors)
    expect([...index.embedded.keys()]).toEqual(['Table '])
    expect(errors).toEqual(['a.json: source also in b.json, make it a source record'])
  })
})
