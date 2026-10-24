import { describe, expect, it } from 'vitest'
import { targetSheet } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const sheet = {
  photo: 'p1',
  references: [
    { kind: 'line', a: { x: 10, y: 20 }, b: { x: 1010, y: 20 }, length: 0.1 },
    { kind: 'ringCentre', centre: { x: 500, y: 500 }, edge: { x: 750, y: 500 }, diameter: 0.05 },
    {
      kind: 'ringEdge',
      points: [
        { x: 250, y: 500 },
        { x: 500, y: 250 },
        { x: 750, y: 500 },
      ],
      diameter: 0.05,
    },
    {
      kind: 'rectangle',
      corners: [
        { x: 0, y: 0 },
        { x: 3000, y: 10 },
        { x: 2990, y: 2000 },
        { x: 5, y: 1990 },
      ],
      width: 0.3,
      height: 0.2,
    },
  ],
  targetRotation: -0.04,
  photoRotation: 1.6,
  targetOrigin: { x: 1500, y: 1000 },
  groups: [
    {
      id: 'g1',
      name: 'Step 3',
      colour: '#d9480f',
      distance: 100,
      aim: { x: 0, y: 0 },
      ladderStep: 2,
      shots: [
        { x: 0.0032, y: -0.0015, placement: 'placed' },
        {
          x: 0.0051,
          y: 0.0004,
          placement: 'detected',
          holeDiameter: 0.0079,
          chrono: { session: 's1', string: 0, shot: 2 },
        },
        { x: 0.021, y: 0.012, placement: 'placed', excluded: true },
      ],
      detection: {
        region: [
          { x: 900, y: 500 },
          { x: 2100, y: 500 },
          { x: 2100, y: 1500 },
          { x: 900, y: 1500 },
        ],
        expectedHoleDiameter: 0.0078,
        backing: '#f0e6c8',
        minContrast: 0.2,
      },
      face: {
        id: 'issf-50m-rifle',
        event: '50m-rifle-prone',
        marks: [
          { ring: 8, x: 0.0212, y: 0 },
          { ring: 8, x: -0.0212, y: 0 },
          { ring: 6, x: 0, y: 0.0372 },
          { ring: 6, x: 0, y: -0.0372 },
        ],
      },
    },
    {
      id: 'g2',
      name: 'Empty',
      colour: '#1971c2',
      distance: 100,
      shots: [],
      face: { id: 'issf-300m-rifle' },
    },
  ],
  load: 'w4',
  markerDiameter: 0.00782,
  notes: [
    { id: 'n1', x: 0.01, y: -0.02, text: 'ES {extremeSpread.length}', group: 'g1' },
    { id: 'n2', x: 0, y: 0, text: 'Lot 7' },
  ],
  overlays: { spread: true, numbers: false, stats: true, rings: true },
}

describe('targetSheet', () => {
  it('parses a sheet and survives a JSON round trip', () => {
    const parsed = targetSheet.parse(sheet)
    expect(parsed).toEqual(sheet)
    expect(targetSheet.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed)
  })

  it('parses a drawn target without a photo', () => {
    expect(targetSheet.safeParse({ references: [], targetRotation: 0, groups: [] }).success).toBe(
      true,
    )
  })

  it('refuses two rectangles, duplicate group ids and a ladder step without a load', () => {
    const rect = sheet.references[3]
    const bad = [
      [{ ...sheet, references: [rect, rect] }, 'references'],
      [{ ...sheet, groups: [sheet.groups[0], { ...sheet.groups[1], id: 'g1' }] }, 'groups.1.id'],
      [{ ...sheet, load: undefined }, 'groups.0.ladderStep'],
      [{ ...sheet, references: [sheet.references[0]], photo: undefined }, 'references'],
      [{ ...sheet, markerDiameter: 0 }, 'markerDiameter'],
      [{ ...sheet, notes: [sheet.notes[0], { ...sheet.notes[1], id: 'n1' }] }, 'notes.1.id'],
      [{ ...sheet, notes: [{ ...sheet.notes[1], text: 'x'.repeat(1001) }] }, 'notes.0.text'],
      [
        {
          ...sheet,
          notes: Array.from({ length: 51 }, (_, i) => ({ ...sheet.notes[1], id: `n${i}` })),
        },
        'notes',
      ],
      [{ ...sheet, overlays: { spread: 'yes' } }, 'overlays.spread'],
    ] as const
    for (const [s, path] of bad) expectIssueAt(targetSheet, s, path)
  })

  it('refuses detection choices out of range: a region of 2 points, a hole size of zero, a backing that is no colour, a contrast above 1', () => {
    const g = sheet.groups[0]
    for (const [detection, field] of [
      [{ region: g.detection?.region.slice(0, 2) }, 'region'],
      [{ expectedHoleDiameter: 0 }, 'expectedHoleDiameter'],
      [{ backing: 'yellow' }, 'backing'],
      [{ minContrast: 1.5 }, 'minContrast'],
    ] as const)
      expectIssueAt(
        targetSheet,
        { ...sheet, groups: [{ ...g, detection }] },
        `groups.0.detection.${field}`,
      )
    expect(targetSheet.safeParse({ ...sheet, groups: [{ ...g, detection: {} }] }).success).toBe(
      true,
    )
  })

  it('refuses a face alignment of fewer than four marks or marks on one ring', () => {
    const g = sheet.groups[0]
    const marks = g.face?.marks ?? []
    for (const [face, path] of [
      [{ id: 'issf-50m-rifle', marks: marks.slice(0, 3) }, 'marks'],
      [{ id: 'issf-50m-rifle', marks: marks.map((m) => ({ ...m, ring: 8 })) }, 'marks'],
      [
        { id: 'issf-50m-rifle', marks: [{ ...marks[0], ring: 0 }, ...marks.slice(1)] },
        'marks.0.ring',
      ],
      [{ id: '' }, 'id'],
      [{ id: 'issf-50m-rifle', event: '50m Rifle Prone' }, 'event'],
    ] as const)
      expectIssueAt(targetSheet, { ...sheet, groups: [{ ...g, face }] }, `groups.0.face.${path}`)
  })

  it('refuses lengths of zero and unknown shot origins', () => {
    const line = { ...sheet.references[0], length: 0 }
    const shot = { ...sheet.groups[0].shots[0], placement: 'typed' }
    expectIssueAt(targetSheet, { ...sheet, references: [line] }, 'references.0.length')
    expectIssueAt(
      targetSheet,
      { ...sheet, groups: [{ ...sheet.groups[0], shots: [shot] }] },
      'groups.0.shots.0.placement',
    )
  })
})
