import { describe, expect, it } from 'vitest'
import { targetFace } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const mm = (value: number) => ({ value })
const face = {
  id: 'test-face',
  name: 'Test face',
  federation: 'test',
  rings: [
    { value: 9, diameter: mm(20) },
    { value: 10, diameter: mm(10) },
  ],
  innerTen: { diameter: mm(5), rule: 'touch' },
  blackDiameter: mm(20),
  decimal: true,
  events: [{ id: 'test-event', name: 'Test event', distance: mm(10000), gauge: mm(4.5) }],
  provenance: { kind: 'published', sources: [{ title: 'Test rule book' }] },
}

describe('targetFace', () => {
  it('accepts a face with rings outer to inner', () => {
    expect(targetFace.safeParse(face).success).toBe(true)
  })

  it('accepts a face whose rule book states no tenth-ring rule', () => {
    const { decimal: _, ...unstated } = face
    expect(targetFace.safeParse(unstated).success).toBe(true)
  })

  it('refuses rings out of order, skipped values and an inner ten larger than the inner ring', () => {
    const rings = [...face.rings].reverse()
    expectIssueAt(targetFace, { ...face, rings }, 'rings.1.value')
    const skipped = [face.rings[0], { value: 11, diameter: mm(10) }]
    expectIssueAt(targetFace, { ...face, rings: skipped }, 'rings.1.value')
    const innerTen = { diameter: mm(11), rule: 'touch' }
    expectIssueAt(targetFace, { ...face, innerTen }, 'innerTen.diameter')
  })

  it('refuses an event id used twice in a face and one that is no record id', () => {
    const second = { ...face.events[0], name: 'Other' }
    expectIssueAt(targetFace, { ...face, events: [face.events[0], second] }, 'events.1.id')
    expectIssueAt(
      targetFace,
      { ...face, events: [{ ...face.events[0], id: 'Test Event' }] },
      'events.0.id',
    )
  })

  it('refuses a face without events or with a non-positive gauge', () => {
    expectIssueAt(targetFace, { ...face, events: [] }, 'events')
    const events = [{ id: 'test-event', name: 'Test event', distance: mm(10000), gauge: mm(0) }]
    expectIssueAt(targetFace, { ...face, events }, 'events.0.gauge')
  })

  it('accepts an inner ten without a rule and an event of another federation with its section', () => {
    const events = [
      { ...face.events[0], federation: 'other', section: '1.2' },
      { id: 'second', name: 'Second', distance: mm(10000) },
    ]
    expect(targetFace.safeParse({ ...face, innerTen: { diameter: mm(5) }, events }).success).toBe(
      true,
    )
    expectIssueAt(
      targetFace,
      { ...face, events: [{ ...events[0], section: '' }] },
      'events.0.section',
    )
  })
})

describe('targetFace outward gauging', () => {
  const { decimal: _, ...whole } = face
  const withScoring = (scoring?: string) => ({
    ...whole,
    events: [{ ...face.events[0], ...(scoring && { scoring }) }],
  })

  it('accepts an outward event and parses touch, centre and no rule unchanged', () => {
    for (const scoring of [undefined, 'touch', 'centre', 'outward']) {
      const record = withScoring(scoring)
      expect(targetFace.parse(record)).toEqual(record)
    }
  })

  it('refuses an outward event on oval, square or stadium rings and on a decimal face', () => {
    const oval = whole.rings.map((r, i) => ({ ...r, height: mm(30 - 10 * i) }))
    expectIssueAt(targetFace, { ...withScoring('outward'), rings: oval }, 'events.0.scoring')
    const square = [{ ...face.rings[0], shape: 'square' }, face.rings[1]]
    expectIssueAt(targetFace, { ...withScoring('outward'), rings: square }, 'events.0.scoring')
    expectIssueAt(targetFace, { ...withScoring('outward'), decimal: true }, 'events.0.scoring')
  })
})

describe('targetFace extended geometry', () => {
  const rings = [
    { value: 8, diameter: mm(30), fill: 'white', line: 'black' },
    { value: 9, diameter: mm(20), fill: 'black', line: 'white' },
    { value: 10, diameter: mm(10), fill: 'black', line: 'white' },
  ]
  const faceWith = (extra: object) => ({
    ...face,
    rings,
    blackDiameter: mm(20),
    decimal: false,
    ...extra,
  })
  const ok = (extra: object) => targetFace.safeParse(faceWith(extra))

  it('accepts colours, a sheet, bulls and the numerals flag', () => {
    const r = ok({
      paper: { format: 'A4', width: mm(210), height: mm(297) },
      bulls: [
        { x: mm(-50), y: mm(60), zone: 'left' },
        { x: mm(50), y: mm(-60) },
      ],
      numerals: true,
    })
    expect(r.success).toBe(true)
  })

  it('refuses a black diameter that is not the outermost black ring', () => {
    expectIssueAt(targetFace, faceWith({ blackDiameter: mm(30) }), 'blackDiameter')
    const split = [
      { ...rings[0], fill: 'black' },
      { ...rings[1], fill: 'white' },
      { ...rings[2], fill: 'black' },
    ]
    expectIssueAt(targetFace, faceWith({ rings: split, blackDiameter: mm(30) }), 'rings')
  })

  it('refuses a sheet that is not its format, and a bull off the sheet', () => {
    expectIssueAt(
      targetFace,
      faceWith({ paper: { format: 'A4', width: mm(200), height: mm(297) } }),
      'paper',
    )
    expect(ok({ paper: { format: 'A4', width: mm(297), height: mm(210) } }).success).toBe(true)
    const paper = { width: mm(100), height: mm(100) }
    expectIssueAt(targetFace, faceWith({ paper, bulls: [{ x: mm(60), y: mm(0) }] }), 'bulls.0')
  })

  it('accepts oval rings on all rings only, each smaller than the one outside', () => {
    const oval = [40, 26, 12].map((height, i) => ({ ...rings[i], height: mm(height) }))
    expect(ok({ rings: oval, blackHeight: mm(26) }).success).toBe(true)
    expectIssueAt(targetFace, faceWith({ rings: [oval[0], rings[1], rings[2]] }), 'rings')
    expectIssueAt(
      targetFace,
      faceWith({ rings: [oval[0], { ...oval[1], height: mm(45) }, oval[2]] }),
      'rings.1.height',
    )
    expectIssueAt(targetFace, faceWith({ blackHeight: mm(26) }), 'rings')
  })

  it('accepts stadium rings on all rings, each at least as high as wide, with a stadium inner ten', () => {
    const stadium = [40, 26, 12].map((height, i) => ({
      ...rings[i],
      height: mm(height),
      shape: 'stadium',
    }))
    const innerTen = { diameter: mm(5), height: mm(8), rule: 'touch' }
    expect(ok({ rings: stadium, innerTen }).success).toBe(true)
    expectIssueAt(targetFace, faceWith({ rings: [stadium[0], rings[1], rings[2]] }), 'rings')
    const flat = [{ ...stadium[0], height: mm(15) }, stadium[1], stadium[2]]
    expectIssueAt(targetFace, faceWith({ rings: flat }), 'rings.0.height')
    const noHeight = [{ ...rings[0], shape: 'stadium' }, rings[1], rings[2]]
    expectIssueAt(targetFace, faceWith({ rings: noHeight }), 'rings')
    expectIssueAt(
      targetFace,
      faceWith({ rings: stadium, innerTen: { diameter: mm(5) } }),
      'innerTen.height',
    )
    expectIssueAt(
      targetFace,
      faceWith({ rings: stadium, innerTen: { ...innerTen, height: mm(4) } }),
      'innerTen.height',
    )
    expectIssueAt(targetFace, faceWith({ rings: stadium, decimal: true }), 'decimal')
  })

  it('accepts a square ring and refuses a square with a height', () => {
    const square = [{ ...rings[0], shape: 'square' }, rings[1], rings[2]]
    expect(ok({ rings: square }).success).toBe(true)
    const tall = [{ ...square[0], height: mm(40) }, rings[1], rings[2]]
    expectIssueAt(targetFace, faceWith({ rings: tall }), 'rings.0.height')
    expectIssueAt(
      targetFace,
      faceWith({ rings: [{ ...rings[0], shape: 'round' }] }),
      'rings.0.shape',
    )
  })

  it('refuses tenth-ring values on a square or oval face, and a cover rule on an oval inner ten', () => {
    const square = [{ ...rings[0], shape: 'square' }, rings[1], rings[2]]
    expectIssueAt(targetFace, faceWith({ rings: square, decimal: true }), 'decimal')
    const oval = [40, 26, 12].map((height, i) => ({ ...rings[i], height: mm(height) }))
    expectIssueAt(targetFace, faceWith({ rings: oval, decimal: true }), 'decimal')
    expect(ok({ rings: square, decimal: false }).success).toBe(true)
    const inner = { diameter: mm(5), height: mm(4), rule: 'cover' }
    expectIssueAt(targetFace, faceWith({ rings: oval, innerTen: inner }), 'innerTen.rule')
    expect(ok({ rings: oval, innerTen: { ...inner, rule: 'touch' } }).success).toBe(true)
  })

  it('accepts an event with a category and refuses an event with caliber classes', () => {
    const events = [{ ...face.events[0], category: 'rifle' }]
    expect(targetFace.safeParse({ ...face, events }).success).toBe(true)
    const caliber = { classes: ['rimfire-22'], basis: 'stated', source: { title: 'Rule book' } }
    const old = [{ ...face.events[0], caliber }]
    expectIssueAt(targetFace, { ...face, events: old }, 'events.0')
  })
})
