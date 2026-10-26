import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  bullet,
  cartridge,
  caseTypes,
  chronoSession,
  firingSeries,
  load,
  manufacturer,
  powder,
  rangeFirings,
  sheetId,
  source,
  specValue,
} from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const measured = { kind: 'measured', sources: [{ title: 'Range log' }] } as const

const validLoad = {
  id: 'test-load',
  origin: 'catalogue',
  name: 'Test load',
  cartridge: 'catalogue:test-cartridge',
  bullet: {
    manufacturer: 'catalogue:test-manufacturer',
    model: 'Model',
    bulletMass: { value: 10, raw: '154.3 gr' },
  },
  powder: { manufacturer: 'catalogue:test-manufacturer', name: 'Powder' },
  charge: { value: 3 },
  primer: { manufacturer: 'catalogue:test-manufacturer', model: 'LR' },
  case: { manufacturer: 'catalogue:test-manufacturer', firingCount: 1 },
  provenance: measured,
}

const validSession = {
  id: 'test-session',
  origin: 'catalogue',
  date: '2026-10-08',
  device: { kind: 'doppler-radar', manufacturer: 'catalogue:test-maker', model: 'Model' },
  conditions: { airTemperature: { value: 15 } },
  strings: [{ load: 'catalogue:test-load', shots: [{ velocity: { value: 800 } }] }],
  provenance: measured,
}

describe('source', () => {
  it('takes an SPDX id or a LicenseRef with terms as the license', () => {
    const terms = {
      title: 'Data sheet',
      publisher: 'Manufacturer',
      terms: 'https://example.com/terms',
    }
    expect(source.safeParse({ ...terms, license: 'CC-BY-4.0' }).success).toBe(true)
    expect(source.safeParse({ ...terms, license: 'LicenseRef-manufacturer-data' }).success).toBe(
      true,
    )
    expectIssueAt(source, { ...terms, license: 'any use allowed' }, 'license')
  })

  it('takes only http and https links in url and terms', () => {
    const ok = (s: object) => source.safeParse({ title: 'Data sheet', ...s }).success
    expect(ok({ url: 'https://example.com/sheet.pdf', terms: 'http://example.com/terms' })).toBe(
      true,
    )
    expect(ok({ terms: 'Written permission on file' })).toBe(true)
    for (const link of ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com/x'])
      expect(ok({ url: link })).toBe(false)
    // terms: a link only from http:// or https://, any other text a note shown as text
    for (const note of ['Permission: granted by mail, 2026-11-02', 'javascript:alert(1)'])
      expect(ok({ terms: note })).toBe(true)
    for (const link of ['http://', 'https://a b']) expect(ok({ terms: link })).toBe(false)
  })
})

describe('load', () => {
  it('accepts a complete load', () => {
    expect(load.safeParse(validLoad).success).toBe(true)
  })

  it('refers to its firearm and holds none inline', () => {
    expect(load.safeParse({ ...validLoad, firearm: 'catalogue:test-rifle' }).success).toBe(true)
    expectIssueAt(load, { ...validLoad, firearm: 'test-rifle' }, 'firearm')
    expectIssueAt(load, { ...validLoad, firearm: { name: 'Test rifle' } }, 'firearm')
  })

  it('rejects an id that is not kebab-case', () => {
    expectIssueAt(load, { ...validLoad, id: 'Test Load' }, 'id')
  })

  it('rejects a provenance without sources', () => {
    const provenance = { kind: 'measured', sources: [] }
    expectIssueAt(load, { ...validLoad, provenance }, 'provenance.sources')
  })
})

describe('chronoSession', () => {
  it('accepts a session', () => {
    expect(chronoSession.safeParse(validSession).success).toBe(true)
  })

  it('rejects a session whose provenance is not measured', () => {
    const provenance = { ...measured, kind: 'computed' }
    expectIssueAt(chronoSession, { ...validSession, provenance }, 'provenance')
  })

  it('rejects an invalid date', () => {
    expectIssueAt(chronoSession, { ...validSession, date: '2026-13-01' }, 'date')
  })
})

describe('firingSeries', () => {
  const series = {
    id: 'paper-2026-720-mm',
    cartridge: '7-62-x-54-r',
    ammunition: '7.62x54R ammunition',
    roundCount: 2,
    velocity: { point: 'initial velocity', shots: [{ value: 800 }, { value: 802 }] },
    provenance: {
      kind: 'measured',
      sources: [{ title: 'Paper', url: 'https://doi.org/10.1/x', license: 'CC-BY-4.0' }],
    },
  }

  it('accepts single shots, one per round', () => {
    expect(firingSeries.safeParse(series).success).toBe(true)
    expectIssueAt(firingSeries, { ...series, roundCount: 3 }, 'velocity.shots')
  })

  it('needs a mean or single shots', () => {
    expectIssueAt(firingSeries, { ...series, velocity: { point: 'initial velocity' } }, 'velocity')
  })

  it('needs the license and URL of every source', () => {
    const [source] = series.provenance.sources
    for (const sources of [[{ ...source, license: undefined }], [{ ...source, url: undefined }]]) {
      const provenance = { ...series.provenance, sources }
      expectIssueAt(firingSeries, { ...series, provenance }, 'provenance')
    }
  })
})

describe('rangeFirings', () => {
  const firings = {
    id: 'report-1988-m118',
    projectile: 'M118 Match Bullet',
    bulletDiameter: { value: 7.82 },
    bulletMass: { value: 11.27 },
    rounds: [
      {
        label: '13903',
        mach: { value: 2.191 },
        totalYaw: { value: 2.6, raw: '2.60' },
        dragCoefficient: { value: 0.329, raw: '.3290' },
      },
    ],
    provenance: {
      kind: 'measured',
      sources: [{ title: 'Report', url: 'https://example.org/r', sha256: 'a'.repeat(64) }],
    },
  }

  it('accepts rounds with Mach, yaw and drag coefficient', () => {
    expect(rangeFirings.safeParse(firings).success).toBe(true)
  })

  it('rejects a provenance that is not measured, lacks URL and sha256, or cites two reports', () => {
    for (const provenance of [
      { ...firings.provenance, kind: 'computed' },
      { ...firings.provenance, sources: [{ title: 'Report' }] },
      {
        ...firings.provenance,
        sources: [...firings.provenance.sources, ...firings.provenance.sources],
      },
    ]) {
      expectIssueAt(rangeFirings, { ...firings, provenance }, 'provenance')
    }
  })

  it('rejects a round listed twice and negative values', () => {
    const [round] = firings.rounds
    expectIssueAt(rangeFirings, { ...firings, rounds: [round, round] }, 'rounds.1.label')
    const negative = { ...round, totalYaw: { value: -4.52 } }
    expectIssueAt(rangeFirings, { ...firings, rounds: [negative] }, 'rounds.0.totalYaw')
    expectIssueAt(rangeFirings, { ...firings, bulletDiameter: { value: 0 } }, 'bulletDiameter')
  })
})

describe('caseTypes', () => {
  it('lists the case heads of the API', () => {
    expect(caseTypes.options).toEqual(['rimless', 'semi-rimmed', 'rimmed', 'rebated', 'belted'])
  })
})

describe('bullet', () => {
  const base = {
    id: 'test-bullet-1',
    manufacturer: 'test-manufacturer',
    productNumber: '1',
    name: 'Test bullet',
    diameter: { value: 7.823 },
    mass: { value: 10.886 },
    provenance: {
      kind: 'published',
      sources: [
        { title: 'Data sheet' },
        { title: 'Photograph', kind: 'measured', fields: ['meplatDiameter'] },
      ],
    },
  } as const

  it('accepts the geometry fields, each optional', () => {
    expect(bullet.safeParse(base).success).toBe(true)
    const full = {
      ...base,
      meplatDiameter: { value: 1.6 },
      base: {
        type: 'boat-tail',
        length: { value: 4.3 },
        diameter: { value: 6.6 },
        angle: { value: 8 },
      },
      ogive: { form: 'secant', radius: { value: 60 }, radiusRatio: { value: 0.5 } },
      tip: { type: 'polymer-tip', length: { value: 3.2 } },
    }
    expect(bullet.parse(full)).toEqual(full)
    const hollow = { ...base, tip: { type: 'hollow-point', mouthDiameter: { value: 1.5 } } }
    const unnamed = { ...base, ogive: { radiusRatio: { value: 0.5 } } }
    expect(bullet.parse(unnamed)).toEqual(unnamed)
    expect(bullet.parse(hollow)).toEqual(hollow)
  })

  it('accepts the round and flat nose forms and a cannelure', () => {
    for (const form of ['round-nose', 'flat-nose']) {
      expect(bullet.safeParse({ ...base, ogive: { form } }).success).toBe(true)
    }
    const grooved = { ...base, cannelure: { start: { value: 9 }, width: { value: 1.2 } } }
    expect(bullet.parse(grooved)).toEqual(grooved)
    const deep = {
      ...base,
      cannelure: { start: { value: 9 }, width: { value: 1.2 }, depth: { value: 0.2 } },
    }
    expect(bullet.parse(deep)).toEqual(deep)
    expect(bullet.safeParse({ ...base, cannelure: { start: { value: 9 } } }).success).toBe(false)
    expect(
      bullet.safeParse({ ...base, cannelure: { start: { value: 9 }, width: { value: 0 } } })
        .success,
    ).toBe(false)
  })

  it('refuses a cannelure that leaves the shank or is deeper than the radius', () => {
    const groove = (start: number, width: number, depth?: number) => ({
      start: { value: start },
      width: { value: width },
      ...(depth === undefined ? {} : { depth: { value: depth } }),
    })
    const issues = (extra: object) => {
      const r = bullet.safeParse({ ...base, ...extra })
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
    }
    const shaped = { length: { value: 30 }, noseLength: { value: 12 } }
    // the shank runs from 0 to 18 mm, so the groove may end exactly at 18
    expect(issues({ ...shaped, cannelure: groove(16.8, 1.2) })).toEqual([])
    expect(issues({ ...shaped, cannelure: groove(17, 1.2) })).toEqual(['cannelure.width'])
    // without a nose length only the length bounds the groove
    expect(issues({ length: { value: 30 }, cannelure: groove(28.8, 1.2) })).toEqual([])
    expect(issues({ length: { value: 30 }, cannelure: groove(29, 1.2) })).toEqual([
      'cannelure.width',
    ])
    // behind a boat tail the shank begins where the tail ends
    const tailed = { base: { type: 'boat-tail', length: { value: 4 } } }
    expect(issues({ ...shaped, ...tailed, cannelure: groove(4, 1.2) })).toEqual([])
    expect(issues({ ...shaped, ...tailed, cannelure: groove(3.5, 1.2) })).toEqual([
      'cannelure.start',
    ])
    // a flat base has no tail: a stated base length does not move the rear bound
    const flat = { base: { type: 'flat', length: { value: 4 } } }
    expect(issues({ ...shaped, ...flat, cannelure: groove(1, 1.2) })).toEqual([])
    // the depth stays below the radius (3.9115 mm)
    expect(issues({ cannelure: groove(9, 1.2, 3.9) })).toEqual([])
    expect(issues({ cannelure: groove(9, 1.2, base.diameter.value / 2) })).toEqual([
      'cannelure.depth',
    ])
    expect(issues({ cannelure: groove(9, 1.2, 3.92) })).toEqual(['cannelure.depth'])
  })

  it('carries the unit of each geometry field in the JSON Schema', () => {
    const json = z.toJSONSchema(bullet, { io: 'input' }) as {
      properties: Record<string, { properties?: Record<string, unknown> }>
    }
    const unit = (s: unknown) => JSON.stringify(s).match(/"unit":"([^"]+)"/)?.[1]
    const { meplatDiameter, base, ogive, tip } = json.properties
    expect(unit(meplatDiameter)).toBe('mm')
    expect(unit(base?.properties?.diameter)).toBe('mm')
    expect(unit(base?.properties?.angle)).toBe('deg')
    expect(unit(ogive?.properties?.radius)).toBe('mm')
    expect(unit(ogive?.properties?.radiusRatio)).toBe('1')
    expect(unit(tip?.properties?.length)).toBe('mm')
    expect(unit(tip?.properties?.mouthDiameter)).toBe('mm')
  })

  const rejectsAt = (patch: Record<string, unknown>, path: string) =>
    expectIssueAt(bullet, { ...base, ...patch }, path)
  const accepts = (patch: Record<string, unknown>) =>
    expect(bullet.safeParse({ ...base, ...patch }).success).toBe(true)
  const tail = (fields: Record<string, unknown>) => ({ base: { type: 'boat-tail', ...fields } })

  it('takes the construction as the manufacturer wording with optional structured fields', () => {
    accepts({ construction: { raw: 'Jacketed Lead' } })
    accepts({
      construction: {
        raw: 'Jacketed Lead',
        structure: 'cup-and-core',
        core: { material: 'lead' },
        jacket: {},
        surface: ['moly'],
      },
    })
    accepts({ construction: { raw: 'Copper', unmapped: true } })
    rejectsAt({ construction: 'Jacketed Lead' }, 'construction')
    rejectsAt({ construction: { raw: 'x', structure: 'frangible' } }, 'construction.structure')
    rejectsAt(
      { construction: { raw: 'x', core: { material: 'tungsten' } } },
      'construction.core.material',
    )
    rejectsAt({ construction: { raw: 'x', surface: [] } }, 'construction.surface')
    rejectsAt({ construction: { raw: 'x', unmapped: true, structure: 'bonded' } }, 'construction')
  })

  it('needs a source that names the country, from a code of two capital letters', () => {
    const named = { title: 'Contact page', fields: ['country'] }
    const sources = (...more: object[]) => ({
      provenance: { kind: 'published', sources: [...base.provenance.sources, ...more] },
    })
    expect(bullet.parse({ ...base, country: 'US', ...sources(named) }).country).toBe('US')
    rejectsAt({ country: 'US' }, 'country')
    rejectsAt(
      { country: 'US', provenance: { kind: 'published', sources: [{ title: 'Sheet' }] } },
      'country',
    )
    for (const country of ['us', 'USA', 'United States'])
      rejectsAt({ country, ...sources(named) }, 'country')
  })

  it('rejects an ogive without form, radius and Rt/R', () => {
    rejectsAt({ ogive: {} }, 'ogive')
    accepts({ ogive: { radius: { value: 60 } } })
  })

  it('takes a tip length only for a polymer tip and a mouth diameter only for a hollow point', () => {
    rejectsAt({ tip: { type: 'hollow-point', length: { value: 3 } } }, 'tip.length')
    rejectsAt({ tip: { type: 'polymer-tip', mouthDiameter: { value: 1.5 } } }, 'tip.mouthDiameter')
    rejectsAt({ tip: { type: 'open-meplat', mouthDiameter: { value: 1.5 } } }, 'tip.mouthDiameter')
    accepts({ tip: { type: 'polymer-tip', length: { value: 3 } } })
    accepts({ tip: { type: 'hollow-point', mouthDiameter: { value: 1.5 } } })
  })

  it('takes a base diameter and angle only for a boat tail', () => {
    rejectsAt({ base: { diameter: { value: 6.6 } } }, 'base.diameter')
    rejectsAt({ base: { type: 'flat', angle: { value: 8 } } }, 'base.angle')
    accepts(tail({ diameter: { value: 6.6 }, angle: { value: 8 } }))
    accepts({ base: { type: 'rebated-boat-tail', diameter: { value: 6.6 } } })
  })

  it('takes a hollow base with its cavity diameter, alone or on a tail', () => {
    const hollow = (type: string, fields: Record<string, unknown> = {}) => ({
      length: { value: 30 },
      base: { type, cavityDiameter: { value: 5 }, ...fields },
    })
    for (const type of ['conical-hollow-base', 'rounded-hollow-base']) {
      accepts(hollow(type))
      accepts(hollow(type, { length: { value: 3 }, diameter: { value: 6.6 }, angle: { value: 8 } }))
      rejectsAt({ base: { type } }, 'base.cavityDiameter')
    }
    rejectsAt({ base: { type: 'flat', cavityDiameter: { value: 5 } } }, 'base.cavityDiameter')
    rejectsAt({ base: { cavityDiameter: { value: 5 } } }, 'base.cavityDiameter')
    rejectsAt({ base: { type: 'boat-tail', cavityDiameter: { value: 5 } } }, 'base.cavityDiameter')
  })

  it('keeps the cavity inside the base face and the tail inside the bullet', () => {
    const hollow = (fields: Record<string, unknown>) => ({
      length: { value: 30 },
      base: { type: 'conical-hollow-base', ...fields },
    })
    rejectsAt(hollow({ cavityDiameter: { value: 7.823 } }), 'base.cavityDiameter')
    rejectsAt(
      hollow({ cavityDiameter: { value: 6.6 }, diameter: { value: 6.6 } }),
      'base.cavityDiameter',
    )
    accepts(hollow({ cavityDiameter: { value: 6 }, diameter: { value: 6.6 } }))
    rejectsAt(
      {
        length: { value: 5 },
        base: { type: 'conical-hollow-base', cavityDiameter: { value: 12 } },
      },
      'base.cavityDiameter',
    )
    rejectsAt({ length: { value: 30 }, ...tail({ length: { value: 30 } }) }, 'base.length')
    rejectsAt({ length: { value: 30 }, ...tail({ length: { value: 31 } }) }, 'base.length')
    accepts({ length: { value: 30 }, ...tail({ length: { value: 5 } }) })
  })

  it('rejects geometry values out of range', () => {
    rejectsAt({ meplatDiameter: { value: -0.1 } }, 'meplatDiameter')
    accepts({ meplatDiameter: { value: 0 } })
    rejectsAt({ meplatDiameter: { value: 7.823 } }, 'meplatDiameter')
    rejectsAt(tail({ diameter: { value: 0 } }), 'base.diameter')
    rejectsAt(tail({ diameter: { value: 7.823 } }), 'base.diameter')
    rejectsAt(tail({ diameter: { value: 7.9 } }), 'base.diameter')
    rejectsAt(tail({ angle: { value: 0 } }), 'base.angle')
    rejectsAt(tail({ angle: { value: 90 } }), 'base.angle')
    rejectsAt({ ogive: { radius: { value: 0 } } }, 'ogive.radius')
    rejectsAt({ ogive: { radiusRatio: { value: -0.1 } } }, 'ogive.radiusRatio')
    rejectsAt({ ogive: { radiusRatio: { value: 1.1 } } }, 'ogive.radiusRatio')
    accepts({ ogive: { radiusRatio: { value: 0 } } })
    accepts({ ogive: { radiusRatio: { value: 1 } } })
    rejectsAt({ tip: { type: 'polymer-tip', length: { value: 0 } } }, 'tip.length')
    rejectsAt({ tip: { type: 'hollow-point', mouthDiameter: { value: 0 } } }, 'tip.mouthDiameter')
  })

  it('keeps the mouth inside the diameter and the tip shorter than the bullet and its nose', () => {
    rejectsAt(
      { tip: { type: 'hollow-point', mouthDiameter: { value: 7.823 } } },
      'tip.mouthDiameter',
    )
    const polymer = (value: number) => ({ type: 'polymer-tip', length: { value } })
    rejectsAt({ length: { value: 30 }, tip: polymer(30) }, 'tip.length')
    rejectsAt({ length: { value: 30 }, noseLength: { value: 18 }, tip: polymer(18) }, 'tip.length')
    accepts({ length: { value: 30 }, noseLength: { value: 18 }, tip: polymer(5) })
  })

  it('carries the field ranges in the JSON Schema', () => {
    const json = z.toJSONSchema(bullet, { io: 'input' }) as {
      properties: Record<
        string,
        { properties?: Record<string, { properties?: Record<string, unknown> }> }
      >
    }
    const value = (s: { properties?: Record<string, unknown> } | undefined) => s?.properties?.value
    const { meplatDiameter, base, ogive, tip } = json.properties
    expect(meplatDiameter?.properties?.value).toMatchObject({ minimum: 0 })
    expect(value(base?.properties?.diameter)).toMatchObject({ exclusiveMinimum: 0 })
    expect(value(base?.properties?.angle)).toMatchObject({
      exclusiveMinimum: 0,
      exclusiveMaximum: 90,
    })
    expect(value(base?.properties?.cavityDiameter)).toMatchObject({ exclusiveMinimum: 0 })
    expect(value(ogive?.properties?.radius)).toMatchObject({ exclusiveMinimum: 0 })
    expect(value(ogive?.properties?.radiusRatio)).toMatchObject({ minimum: 0, maximum: 1 })
    expect(value(tip?.properties?.length)).toMatchObject({ exclusiveMinimum: 0 })
    expect(value(tip?.properties?.mouthDiameter)).toMatchObject({ exclusiveMinimum: 0 })
  })
})

describe('JSON Schema', () => {
  it('carries the unit of each quantity', () => {
    const json = JSON.stringify(z.toJSONSchema(load, { io: 'input' }))
    expect(json).toContain('"unit":"g"')
    expect(json).toContain('"unit":"mm"')
  })
})

describe('specValue', () => {
  it('accepts a raw-only value', () => {
    const value = { symbol: 'M', quantity: 'length', raw: '25/30', variant: '12/70' }
    expect(specValue.safeParse(value).success).toBe(true)
  })

  it('rejects a value without value and raw', () => {
    expect(specValue.safeParse({ symbol: 'L1', quantity: 'length' }).success).toBe(false)
  })

  it('rejects a positive lower tolerance', () => {
    const value = { side: 'cartridge', symbol: 'L1', quantity: 'length', value: 40 }
    expect(specValue.safeParse({ ...value, tolerance: { lower: 0.2 } }).success).toBe(false)
  })
})

describe('cartridge', () => {
  const published = { kind: 'published', sources: [{ title: 'Test standard' }] } as const
  const record = {
    id: 'test-cartridge',
    name: 'Test',
    table: 'I',
    published: '2019-06-01',
    revised: '2020-01-01',
    verification: 'unverified',
    values: [
      {
        side: 'cartridge',
        symbol: 'L1',
        quantity: 'length',
        value: 40,
        tolerance: { lower: -0.2 },
      },
      { symbol: 'Pmax', quantity: 'pressure', value: 4000 },
    ],
    exceptions: [{ finding: 'pk-ratio', note: 'Test' }],
    provenance: published,
  }

  it('accepts a record with values and exceptions', () => {
    expect(cartridge.safeParse(record).success).toBe(true)
  })

  it('names the sheet by the revision date, else the publication date', () => {
    expect(sheetId(record)).toBe('cip-test-cartridge-2020-01-01')
    expect(sheetId({ ...record, revised: undefined })).toBe('cip-test-cartridge-2019-06-01')
  })
})

describe('standards', () => {
  it('rejects CUP as a quantity', () => {
    expect(specValue.safeParse({ symbol: 'MAP', quantity: 'cup', value: 52000 }).success).toBe(
      false,
    )
  })
})

describe('powder', () => {
  const t = (value: number) => ({ value, min: value * 0.9, max: value * 1.1 })
  const valid = {
    id: 'test-powder',
    manufacturer: 'test-manufacturer',
    name: 'Powder',
    composition: [
      { name: 'Nitrocellulose', cas: '9004-70-0', min: 80, max: 99, raw: '80 - <99' },
      { name: 'Not named', min: 0, max: 5 },
    ],
    thermochemistry: {
      loadingDensity: { value: 0.1 },
      flameTemperature: t(3000),
      impetus: t(1.05e6),
      gamma: t(1.23),
      molarMass: t(24.5),
      covolume: t(1.0e-3),
    },
    provenance: measured,
  }

  it('accepts a composition and computed thermochemistry', () => {
    expect(powder.safeParse(valid).success).toBe(true)
  })

  it('accepts a temperature sensitivity and rejects a reference temperature of 0 K or less', () => {
    const temperatureSensitivity = {
      reference: { value: 294.15 },
      cold: { value: 0.004 },
      hot: { value: 0.002 },
    }
    expect(powder.safeParse({ ...valid, temperatureSensitivity }).success).toBe(true)
    for (const value of [0, -1]) {
      expectIssueAt(
        powder,
        { ...valid, temperatureSensitivity: { ...temperatureSensitivity, reference: { value } } },
        'temperatureSensitivity.reference.value',
      )
    }
  })

  it('rejects a composition range with min above max or outside 0 to 100 %', () => {
    for (const [entry, path] of [
      [{ name: 'A', min: 5, max: 1 }, 'composition.0'],
      [{ name: 'A', min: -1, max: 1 }, 'composition.0.min'],
      [{ name: 'A', min: 1, max: 101 }, 'composition.0.max'],
      [{ name: 'A', cas: '9004', min: 1, max: 2 }, 'composition.0.cas'],
    ] as const)
      expectIssueAt(powder, { ...valid, composition: [entry] }, path)
  })

  it('needs a composition for thermochemistry', () => {
    const { composition: _, ...rest } = valid
    expectIssueAt(powder, rest, 'thermochemistry')
  })

  it('rejects composition ranges that cannot sum to 100 %', () => {
    const composition = [{ name: 'A', cas: '9004-70-0', min: 50, max: 60 }]
    expectIssueAt(powder, { ...valid, composition }, 'composition')
  })

  it('rejects a thermochemistry value outside its range', () => {
    const thermochemistry = { ...valid.thermochemistry, gamma: { value: 1.3, min: 1.2, max: 1.25 } }
    expectIssueAt(powder, { ...valid, thermochemistry }, 'thermochemistry.gamma')
  })

  const interior = {
    model: 'm3',
    fitted: ['vivacity', 'energy'],
    vivacity: { value: 0.45, standardUncertainty: 0.01 },
    energy: { value: 4.0e6, standardUncertainty: 1e5 },
    gamma: 1.24,
    covolume: { value: 1.0e-3 },
    density: { value: 1.6 },
    pressureExponent: 1,
    referencePressure: { value: 0.980665 },
    ignitionPressure: { value: 50 },
    startPressure: { value: 300 },
    propellantTemperature: { value: 21 },
    burnForm: { kind: 'twoStage', a: { value: 0.8 }, m: 0.5, q: 0.5, z1: 0.8 },
    trainingRows: 40,
    trainingCartridges: 5,
  }
  const fittedSource = {
    title: 'Manufacturer load data, edition 1',
    fields: ['interior'],
    kind: 'fitted',
    note: '40 training rows.',
  }

  it('accepts fitted interior parameters with a fitted source', () => {
    const provenance = { ...measured, sources: [...measured.sources, fittedSource] }
    expect(powder.safeParse({ ...valid, interior, provenance }).success).toBe(true)
  })

  it('accepts interior parameters fitted with the default start pressure per load', () => {
    const provenance = { ...measured, sources: [...measured.sources, fittedSource] }
    const { startPressure: _, ...rest } = interior
    expect(powder.safeParse({ ...valid, interior: rest, provenance }).success).toBe(true)
  })

  it('needs a fitted source for the interior parameters', () => {
    expect(powder.safeParse({ ...valid, interior }).success).toBe(false)
    const other = { ...fittedSource, kind: 'published' }
    const provenance = { ...measured, sources: [...measured.sources, other] }
    expect(powder.safeParse({ ...valid, interior, provenance }).success).toBe(false)
  })

  it('accepts the bore-resistance constants of the fit and rejects a negative stress', () => {
    const provenance = { ...measured, sources: [...measured.sources, fittedSource] }
    const resistance = { stress: { value: 4.2 }, oversize: 1.3, engraving: 0.85 }
    const ok = (r: object) =>
      powder.safeParse({ ...valid, interior: { ...interior, resistance: r }, provenance }).success
    expect(ok(resistance)).toBe(true)
    expect(ok({ ...resistance, stress: { value: -1 } })).toBe(false)
  })

  it('rejects a form with 1 + a z1 not above 0', () => {
    const provenance = { ...measured, sources: [...measured.sources, fittedSource] }
    const burnForm = { ...interior.burnForm, a: { value: -1.25 } }
    expect(
      powder.safeParse({ ...valid, interior: { ...interior, burnForm }, provenance }).success,
    ).toBe(false)
  })

  it('carries the units of the thermochemistry fields in the JSON Schema', () => {
    const json = z.toJSONSchema(powder, { io: 'input' }) as {
      properties: Record<string, { properties?: Record<string, { unit?: string }> }>
    }
    const fields = json.properties.thermochemistry?.properties ?? {}
    const units = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.unit]))
    expect(units).toEqual({
      loadingDensity: 'g/cm3',
      flameTemperature: 'K',
      impetus: 'J/kg',
      gamma: '1',
      molarMass: 'kg/kmol',
      covolume: 'm3/kg',
    })
  })
})

describe('manufacturer', () => {
  const valid = {
    id: 'test-manufacturer',
    name: 'Test Manufacturer Ltd.',
    aliases: ['Test Brand'],
    provenance: { kind: 'published', sources: [{ title: 'Product page' }] },
  }

  it('accepts a record with aliases and rejects an empty name, empty aliases, a site that is not https and unknown keys', () => {
    expect(manufacturer.safeParse(valid).success).toBe(true)
    expect(manufacturer.safeParse({ ...valid, website: 'https://example.com' }).success).toBe(true)
    for (const website of ['http://example.com', 'javascript:alert(1)'])
      expect(manufacturer.safeParse({ ...valid, website }).success).toBe(false)
    expect(manufacturer.safeParse({ ...valid, name: '' }).success).toBe(false)
    expect(manufacturer.safeParse({ ...valid, aliases: [] }).success).toBe(false)
    expect(manufacturer.safeParse({ ...valid, country: 'DE' }).success).toBe(false)
  })
})
