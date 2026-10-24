import type { Discipline, Federation, TargetFace, TargetMapping } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkFederations } from '../src/federations.ts'

const provenance = { kind: 'published' as const, sources: [{ title: 'Test rule book' }] }
const document = {
  title: 'Rules',
  edition: '1',
  url: 'https://example.org/r.pdf',
  sha256: '0'.repeat(64),
}
const fed = (
  id: string,
  abbreviation: string,
  country: string,
  internationalFederation?: string,
): Federation => ({
  id,
  name: id,
  abbreviation,
  country,
  ...(internationalFederation && { internationalFederation }),
  ruleBooks: [document],
  provenance,
})
const disc = (id: string, federation: string, internationalDiscipline?: string): Discipline => ({
  id,
  federation,
  name: id,
  section: '1',
  page: '1',
  distance: { value: 25000 },
  ...(internationalDiscipline && { internationalDiscipline }),
  provenance,
})
const face: TargetFace = {
  id: 'face',
  name: 'Face',
  organization: 'W',
  rings: [
    { value: 9, diameter: { value: 20 } },
    { value: 10, diameter: { value: 10 } },
  ],
  blackDiameter: { value: 20 },
  decimal: false,
  events: [
    { name: 'World event', distance: { value: 25000 }, gauge: { value: 5.6 } },
    { name: 'National event', distance: { value: 25000 }, organization: 'N' },
  ],
  provenance,
}
const map = (id: string, discipline: string, event: string, gauge?: number): TargetMapping => ({
  id,
  discipline,
  face: 'face',
  event,
  ...(gauge && { gauge: { value: gauge } }),
  provenance,
})
const federations = [fed('world', 'W', 'international'), fed('nation', 'N', 'DE', 'world')]
const disciplines = [disc('world-d', 'world'), disc('nation-d', 'nation', 'world-d')]
const valid = {
  federations,
  disciplines,
  targetMappings: [
    map('m1', 'world-d', 'World event', 5.6),
    map('m2', 'nation-d', 'National event'),
  ],
  targetFaces: [face],
}

describe('checkFederations', () => {
  it('accepts consistent references', () => {
    expect(checkFederations(valid)).toEqual([])
  })

  it('reports international links to national records', () => {
    expect(
      checkFederations({
        ...valid,
        federations: [federations[0], fed('nation', 'N', 'DE', 'nation')],
        disciplines: [
          disc('world-d', 'world'),
          disc('nation-d', 'nation', 'nation-d'),
          disc('x', 'nation', 'gone'),
        ],
      }),
    ).toEqual([
      'federations/nation.json: internationalFederation "nation" is no international federation',
      'disciplines/nation-d.json: internationalDiscipline "nation-d" is no international discipline',
      'disciplines/x.json: unknown international discipline "gone"',
      'disciplines/x.json: no target mapping names it',
    ])
  })

  it('reports a missing event, an event of another federation, a second mapping and another gauge', () => {
    expect(
      checkFederations({
        ...valid,
        targetMappings: [
          map('m1', 'world-d', 'World event', 4.5),
          map('m2', 'world-d', 'National event'),
          map('m3', 'nation-d', 'World event'),
          map('m4', 'nation-d', 'No event'),
        ],
      }),
    ).toEqual([
      "target-mappings/m1.json: gauge 4.5 mm differs from the event's 5.6 mm",
      'target-mappings/m2.json: event "National event" is not one of W',
      'target-mappings/m3.json: event "World event" is also in m1',
      'target-mappings/m3.json: event "World event" is not one of N',
      'target-mappings/m4.json: face "face" has no event "No event"',
    ])
  })
})
