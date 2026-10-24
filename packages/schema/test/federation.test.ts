import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { discipline, federation, targetMapping } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const provenance = { kind: 'published', sources: [{ title: 'Test rule book' }] }
const mm = (value: number) => ({ value })

const validFederation = {
  id: 'test-federation',
  name: 'Test Federation',
  abbreviation: 'TF',
  country: 'DE',
  internationalFederation: 'test-world',
  ruleBooks: [
    {
      title: 'Test rule book',
      edition: '2026',
      url: 'https://example.org/rules.pdf',
      sha256: 'a'.repeat(64),
    },
  ],
  provenance,
}

const validDiscipline = {
  id: 'test-discipline',
  federation: 'test-federation',
  name: 'Test discipline',
  number: '1.10',
  section: '1.10',
  page: 'p. 12',
  distance: mm(50000),
  category: 'rifle',
  caliberClasses: { ids: ['rimfire-22'], basis: 'stated' },
  internationalDiscipline: 'test-world-discipline',
  provenance,
}

const validMapping = {
  id: 'test-mapping',
  discipline: 'test-discipline',
  face: 'test-face',
  event: 'test-event',
  stage: 'precision stage',
  gauge: mm(5.6),
  shotCount: 30,
  provenance,
}

describe('federation', () => {
  it('accepts a national and an international federation', () => {
    expect(federation.safeParse(validFederation).success).toBe(true)
    const world = { ...validFederation, id: 'test-world', country: 'international' }
    expect(federation.safeParse({ ...world, internationalFederation: undefined }).success).toBe(
      true,
    )
  })

  it('refuses a country that is no ISO code, a document without its hash or https link and unknown keys', () => {
    expectIssueAt(federation, { ...validFederation, country: 'Germany' }, 'country')
    const ruleBooks = [{ ...validFederation.ruleBooks[0], sha256: undefined }]
    expectIssueAt(federation, { ...validFederation, ruleBooks }, 'ruleBooks.0.sha256')
    expectIssueAt(federation, { ...validFederation, ruleBooks: [] }, 'ruleBooks')
    for (const url of ['http://example.com/rules.pdf', 'javascript:alert(1)', 'data:text/html,x'])
      expectIssueAt(
        federation,
        { ...validFederation, ruleBooks: [{ ...validFederation.ruleBooks[0], url }] },
        'ruleBooks.0.url',
      )
    expectIssueAt(federation, { ...validFederation, members: [] }, '')
  })
})

describe('discipline', () => {
  it('accepts a discipline with every optional field and one with none', () => {
    expect(discipline.safeParse(validDiscipline).success).toBe(true)
    const { number, category, caliberClasses, internationalDiscipline, ...bare } = validDiscipline
    expect(discipline.safeParse(bare).success).toBe(true)
  })

  it('refuses a caliber class that is no record id, an inferred basis and a missing section', () => {
    const caliberClasses = (c: object) => ({
      ...validDiscipline,
      caliberClasses: { ...validDiscipline.caliberClasses, ...c },
    })
    expectIssueAt(discipline, caliberClasses({ ids: ['Rimfire 99'] }), 'caliberClasses.ids.0')
    expectIssueAt(discipline, caliberClasses({ ids: [] }), 'caliberClasses.ids')
    expectIssueAt(discipline, caliberClasses({ basis: 'inferred' }), 'caliberClasses.basis')
    const { section, ...noSection } = validDiscipline
    expectIssueAt(discipline, noSection, 'section')
  })
})

describe('targetMapping', () => {
  it('accepts a mapping with stage, gauge and shots, and one without', () => {
    expect(targetMapping.safeParse(validMapping).success).toBe(true)
    const { stage, gauge, shotCount, ...bare } = validMapping
    expect(targetMapping.safeParse(bare).success).toBe(true)
  })

  it('refuses a non-positive gauge or shot count', () => {
    expectIssueAt(targetMapping, { ...validMapping, gauge: mm(0) }, 'gauge')
    expectIssueAt(targetMapping, { ...validMapping, shotCount: 0 }, 'shotCount')
    expectIssueAt(targetMapping, { ...validMapping, shotCount: 1.5 }, 'shotCount')
  })
})

it('writes JSON Schema for the three kinds', () => {
  for (const schema of [federation, discipline, targetMapping]) {
    const json = z.toJSONSchema(schema, { io: 'input' }) as { required: string[] }
    expect(json.required).toContain('provenance')
  }
})
