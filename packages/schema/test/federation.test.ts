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
  website: 'https://example.org/',
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
  distance: { ...mm(50000), unit: 'm' },
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

  it('takes an https homepage and refuses any other address', () => {
    const { website, ...bare } = validFederation
    expect(federation.safeParse(bare).success).toBe(true)
    for (const bad of ['http://example.org/', 'javascript:alert(1)', 'example.org', ''])
      expectIssueAt(federation, { ...validFederation, website: bad }, 'website')
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
    const noUnit = { ...validDiscipline, distance: mm(50000) }
    expectIssueAt(discipline, noUnit, 'distance.unit')
    expectIssueAt(
      discipline,
      { ...validDiscipline, distance: { ...mm(50000), unit: 'ft' } },
      'distance.unit',
    )
    const both = { ...validDiscipline, distance: { ...mm(50000), unit: 'm/yd' } }
    expect(discipline.safeParse(both).success).toBe(true)
  })
})

describe('discipline rules', () => {
  const rules = {
    firearm: 'long-gun',
    actions: ['single-shot', 'repeater'],
    positions: ['prone'],
    supports: ['freehand', 'sling'],
    sights: ['open', 'aperture'],
    maxMagnification: { value: 4 },
    minTriggerWeight: { value: 1500, raw: '1500 g' },
    maxBarrelLength: mm(762),
    maxFirearmMass: { value: 4500 },
    ammunition: {
      handloads: true,
      minMuzzleEnergy: { value: 200 },
      minBulletMass: { value: 6 },
      bulletTypes: ['jacketed'],
    },
    sighters: 'unlimited',
    seriesShots: 10,
    timeLimits: [
      { duration: { value: 1800, raw: '30 min' }, covers: 'discipline', includesSighters: true },
    ],
  }
  const withRules = (r: object) => ({ ...validDiscipline, rules: r })

  it('accepts every rule fact, a count of sighters and an empty set', () => {
    expect(discipline.safeParse(withRules(rules)).success).toBe(true)
    expect(discipline.safeParse(withRules({ ...rules, sighters: 0 })).success).toBe(true)
    expect(discipline.safeParse(withRules({})).success).toBe(true)
  })

  it('refuses unknown keys and values, empty lists and non-positive limits', () => {
    expectIssueAt(discipline, withRules({ stance: 'prone' }), 'rules')
    expectIssueAt(discipline, withRules({ firearm: 'shotgun' }), 'rules.firearm')
    expectIssueAt(discipline, withRules({ positions: [] }), 'rules.positions')
    expectIssueAt(discipline, withRules({ positions: ['lying'] }), 'rules.positions.0')
    expectIssueAt(
      discipline,
      withRules({ minTriggerWeight: { value: 0 } }),
      'rules.minTriggerWeight.value',
    )
    expectIssueAt(discipline, withRules({ sighters: 'many' }), 'rules.sighters')
    expectIssueAt(discipline, withRules({ sighters: -1 }), 'rules.sighters')
    expectIssueAt(discipline, withRules({ seriesShots: 0 }), 'rules.seriesShots')
    expectIssueAt(discipline, withRules({ timeLimits: [] }), 'rules.timeLimits')
    expectIssueAt(
      discipline,
      withRules({ timeLimits: [{ duration: { value: 30 }, covers: 'hour' }] }),
      'rules.timeLimits.0.covers',
    )
    expectIssueAt(
      discipline,
      withRules({ ammunition: { bulletTypes: ['lead'], maxPower: 3 } }),
      'rules.ammunition',
    )
  })

  it('puts the stage facts on a mapping', () => {
    const stage = {
      ...validMapping,
      sighters: 5,
      seriesShots: 5,
      timeLimits: [{ duration: { value: 150 }, covers: 'series' }],
    }
    expect(targetMapping.safeParse(stage).success).toBe(true)
    expectIssueAt(targetMapping, { ...stage, seriesShots: 0 }, 'seriesShots')
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
