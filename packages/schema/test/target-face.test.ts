import { describe, expect, it } from 'vitest'
import { targetFace } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const mm = (value: number) => ({ value })
const face = {
  id: 'test-face',
  name: 'Test face',
  organization: 'Test',
  rings: [
    { value: 9, diameter: mm(20) },
    { value: 10, diameter: mm(10) },
  ],
  innerTen: { diameter: mm(5), rule: 'touch' },
  blackDiameter: mm(20),
  decimal: true,
  events: [{ name: 'Test event', distance: mm(10000), gauge: mm(4.5) }],
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

  it('refuses a face without events or with a non-positive gauge', () => {
    expectIssueAt(targetFace, { ...face, events: [] }, 'events')
    const events = [{ name: 'Test event', distance: mm(10000), gauge: mm(0) }]
    expectIssueAt(targetFace, { ...face, events }, 'events.0.gauge')
  })

  it('accepts an inner ten without a rule and an event of another organization with its section', () => {
    const events = [
      { ...face.events[0], organization: 'Other', section: '1.2' },
      { name: 'Second', distance: mm(10000) },
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

describe('targetFace extended geometry', () => {
  const rings = [
    { value: 8, diameter: mm(30), fill: 'white', line: 'black' },
    { value: 9, diameter: mm(20), fill: 'black', line: 'white' },
    { value: 10, diameter: mm(10), fill: 'black', line: 'white' },
  ]
  const faceWith = (extra: object) => ({ ...face, rings, blackDiameter: mm(20), ...extra })
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
    const oval = rings.map((r, i) => ({ ...r, height: mm([40, 26, 12][i]) }))
    expect(ok({ rings: oval, blackHeight: mm(26) }).success).toBe(true)
    expectIssueAt(targetFace, faceWith({ rings: [oval[0], rings[1], rings[2]] }), 'rings')
    expectIssueAt(
      targetFace,
      faceWith({ rings: [oval[0], { ...oval[1], height: mm(45) }, oval[2]] }),
      'rings.1.height',
    )
    expectIssueAt(targetFace, faceWith({ blackHeight: mm(26) }), 'rings')
  })

  it('accepts an event with a category and refuses an event with caliber classes', () => {
    const events = [{ ...face.events[0], category: 'rifle' }]
    expect(targetFace.safeParse({ ...face, events }).success).toBe(true)
    const caliber = { classes: ['rimfire-22'], basis: 'stated', source: { title: 'Rule book' } }
    const old = [{ ...face.events[0], caliber }]
    expectIssueAt(targetFace, { ...face, events: old }, 'events.0')
  })
})
