import type { TargetSheet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { calibrateSheetOnFace, faceGeometry } from '../src/lib/face-sheet.ts'
import { frameOf, viewToTarget } from '../src/lib/target-editor.ts'
import { findFace } from '../src/lib/target-face.ts'
import { apply3 } from '../src/lib/target-geometry.ts'
import { defined } from './defined.ts'
import { faceById, faces, project, render } from './face-render.ts'

// A face found on a photo as the calibration of the sheet
const group = (id: string, face?: NonNullable<TargetSheet['groups'][number]['face']>) => ({
  id,
  name: id,
  colour: '#112233',
  distance: 25,
  shots: [],
  ...(face && { face }),
})
const sheet0 = (): TargetSheet => sheet([group('g1')])
const base = () => sheet([])
const sheet = (groups: TargetSheet['groups']): TargetSheet => ({
  photo: 'photo-1',
  references: [],
  targetRotation: 0.4,
  groups,
})

const face = faceById('issf-25m-precision-50m-pistol')
const camera = { width: 1200, height: 900, pxPerMm: 1.68, depth: 5 }
const line = 2.2 / 1.68

describe('faceSheet', () => {
  it('calibrates the sheet on the face: scale, perspective, centre and axes of the photo', () => {
    // seen from the front, the face's axes are the photo's: x right, y up
    const { image, h } = render({ face, camera, line, noise: 2 })
    const fit = findFace(image, faces).fits[0]
    expect(fit).toBeDefined()
    if (!fit) return
    const next = calibrateSheetOnFace(sheet([group('g1')]), 'g1', {
      id: fit.face.id,
      centre: fit.centre,
      corners: fit.corners,
      outer: fit.outer,
    })
    expect(next.references).toHaveLength(1)
    const ref = defined(next.references[0])
    expect(ref.kind).toBe('rectangle')
    // the square about the outer ring: 500 mm
    if (ref.kind === 'rectangle') expect([ref.width, ref.height]).toEqual([0.5, 0.5])
    expect(next.targetRotation).toBe(0)
    expect(next.targetOrigin).toEqual(fit.centre)
    const frame = frameOf(next)
    expect(frame).toBeDefined()
    if (!frame) return
    for (const [x, y] of [
      [0, 0],
      [40, 30],
      [-120, 15],
      [60, -210],
    ] satisfies [number, number][]) {
      const t = viewToTarget(frame, project(h, { x, y }))
      expect(Math.abs(t.x - x / 1000)).toBeLessThan(0.0015)
      expect(Math.abs(t.y - y / 1000)).toBeLessThan(0.0015)
    }
    expect(defined(next.groups[0]).face).toEqual({ id: fit.face.id })
  })

  it('keeps distances on a tilted, rolled photo', () => {
    const { image, h } = render({
      face,
      camera: { ...camera, tilt: 35, yaw: 15, roll: 25 },
      line,
      noise: 3,
    })
    const fit = findFace(image, faces).fits[0]
    expect(fit).toBeDefined()
    if (!fit) return
    const frame = frameOf(
      calibrateSheetOnFace(sheet([group('g1')]), 'g1', {
        id: fit.face.id,
        centre: fit.centre,
        corners: fit.corners,
        outer: fit.outer,
      }),
    )
    expect(frame).toBeDefined()
    if (!frame) return
    for (const [x, y] of [
      [40, 30],
      [-120, 15],
      [60, -210],
    ] satisfies [number, number][]) {
      const t = viewToTarget(frame, project(h, { x, y }))
      expect(Math.abs(Math.hypot(t.x, t.y) - Math.hypot(x, y) / 1000)).toBeLessThan(0.0015)
    }
  })

  it('sets the face of the active group only: the same face keeps its event, another one starts afresh', () => {
    const found = {
      id: 'issf-25m-precision-50m-pistol',
      centre: { x: 600, y: 450 },
      corners: [
        { x: 100, y: 0 },
        { x: 700, y: 0 },
        { x: 700, y: 800 },
        { x: 100, y: 800 },
      ] as [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ],
      outer: 250,
    }
    const own = { id: found.id, event: '50m Pistol' }
    const kept = calibrateSheetOnFace(sheet([group('g1', own), group('g2')]), 'g1', found)
    expect(defined(kept.groups[0]).face).toEqual(own)
    expect(defined(kept.groups[1]).face).toBeUndefined()
    const other = calibrateSheetOnFace(
      sheet([group('g1', { id: 'issf-300m-rifle', event: 'x' })]),
      'g1',
      found,
    )
    expect(defined(other.groups[0]).face).toEqual({ id: found.id })
    // a plane from a typed diameter has no face: the groups keep theirs
    const { id: _, ...plane } = found
    const typed = calibrateSheetOnFace(sheet([group('g1', own)]), 'g1', plane)
    expect(defined(typed.groups[0]).face).toEqual(own)
    // earlier references go: the rectangle carries the scale
    const line = {
      kind: 'line' as const,
      a: { x: 0, y: 0 },
      b: { x: 10, y: 0 },
      length: 0.1,
    }
    expect(
      calibrateSheetOnFace({ ...sheet([group('g1')]), references: [line] }, 'g1', found).references,
    ).toHaveLength(1)
  })
})

describe('faceGeometry', () => {
  const line = {
    kind: 'line' as const,
    a: { x: 100, y: 450 },
    b: { x: 1100, y: 450 },
    length: 0.5,
  }
  const to = (sheet: TargetSheet) => frameOf(sheet)?.toTarget

  it('is none for a face chosen for scoring on a sheet calibrated otherwise, without marks or aim', () => {
    const sheet: TargetSheet = {
      ...base(),
      references: [line],
      groups: [group('g1', { id: face.id })],
    }
    expect(
      faceGeometry({ sheet, group: sheet.groups[0], record: face, toTarget: to(sheet) }),
    ).toBeUndefined()
    // a record of another face is none either
    const other = faceById('issf-300m-rifle')
    expect(
      faceGeometry({ sheet, group: sheet.groups[0], record: other, toTarget: to(sheet) }),
    ).toBeUndefined()
  })

  it('centres the face on the point of aim the user set', () => {
    const aim = { x: 0.12, y: -0.07 }
    const sheet: TargetSheet = {
      ...base(),
      references: [line],
      groups: [{ ...group('g1', { id: face.id }), aim }],
    }
    const frame = frameOf(sheet)
    const g = faceGeometry({
      sheet,
      group: sheet.groups[0],
      record: face,
      toTarget: frame?.toTarget,
    })
    expect(g).toBeDefined()
    if (!(g && frame)) return
    const at = frame.toImage as number[]
    const p = apply3(at, [aim.x, aim.y, 1])
    const q = apply3(g.toFace as number[], [p[0] / p[2], p[1] / p[2], 1])
    expect(Math.hypot(q[0] / q[2], q[1] / q[2])).toBeLessThan(1e-6)
    expect([g.outer, g.black]).toEqual([250, 100])
  })

  it('takes a sheet calibrated on the face: the origin is the centre, the aim is ignored', () => {
    const { image, h } = render({ face, camera, line: 2.2 / 1.68, noise: 2 })
    const fit = findFace(image, faces).fits[0]
    expect(fit).toBeDefined()
    if (!fit) return
    const calibrated = calibrateSheetOnFace(sheet0(), 'g1', {
      id: fit.face.id,
      centre: fit.centre,
      corners: fit.corners,
      outer: fit.outer,
    })
    const stray = { ...defined(calibrated.groups[0]), aim: { x: 0.2, y: 0.2 } }
    const sheet = { ...calibrated, groups: [stray] }
    const g = faceGeometry({
      sheet,
      group: stray,
      record: face,
      toTarget: to(sheet),
    })
    expect(g).toBeDefined()
    if (!g) return
    for (const [x, y] of [
      [0, 0],
      [60, -40],
    ] satisfies [number, number][]) {
      const i = project(h, { x, y })
      const q = apply3(g.toFace as number[], [i.x, i.y, 1])
      expect(Math.abs(Math.hypot(q[0] / q[2], q[1] / q[2]) - Math.hypot(x, y))).toBeLessThan(1)
    }
  })
})

describe('faceSheet events', () => {
  const found = {
    id: 'f',
    centre: { x: 1, y: 1 },
    corners: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ] as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ],
    outer: 250,
    events: [
      { id: '50m', distance: 50 },
      { id: '25m', distance: 25 },
    ],
  }
  const s = (d: number) => ({ ...sheet0(), groups: [{ ...group('g1'), distance: d }] })

  it('sets the event shot at the group distance, else none, and the event the user chose', () => {
    expect(defined(calibrateSheetOnFace(s(25), 'g1', found).groups[0]).face).toEqual({
      id: 'f',
      event: '25m',
    })
    expect(defined(calibrateSheetOnFace(s(100), 'g1', found).groups[0]).face).toEqual({ id: 'f' })
    expect(
      defined(calibrateSheetOnFace(s(25), 'g1', { ...found, event: '50m' }).groups[0]).face,
    ).toEqual({
      id: 'f',
      event: '50m',
    })
  })

  // the face's events as the editor passes them, and a federation's discipline mapped to it
  const pistol = {
    ...found,
    id: face.id,
    federation: face.federation,
    events: face.events.map((e) => ({
      id: e.id,
      distance: e.distance.value / 1000,
      ...(e.federation && { federation: e.federation }),
    })),
  }
  const data = {
    federations: [
      { id: 'issf', name: 'ISSF', abbreviation: 'ISSF' },
      { id: 'dsb', name: 'DSB', abbreviation: 'DSB' },
    ],
    disciplines: [],
    mappings: [
      { id: 'm1', discipline: 'd1', face: 'issf-10m-air-pistol', event: '10m-air-pistol' },
      { id: 'm2', discipline: 'd1', face: face.id, event: 'dsb-25-m-standardpistole' },
    ],
  }
  const at = (d: number, g = {}) => ({
    ...sheet0(),
    groups: [{ ...group('g1'), ...g, distance: d }],
  })

  it('keeps the federation and the discipline the face fits, and guesses none at a distance of several', () => {
    // 100 m: DSB, BDS, BDMP, DSU and VdRBw shoot this face there, ISSF does not
    expect(defined(calibrateSheetOnFace(at(100), 'g1', pistol, { data }).groups[0]).face).toEqual({
      id: face.id,
    })
    expect(
      defined(calibrateSheetOnFace(at(100), 'g1', pistol, { federation: 'dsb', data }).groups[0])
        .face,
    ).toEqual({ id: face.id, event: 'dsb-gewehr-100-m' })
    expect(
      defined(calibrateSheetOnFace(at(100), 'g1', pistol, { federation: 'issf', data }).groups[0])
        .face,
    ).toEqual({ id: face.id })
    // the face's own organization at its distance
    expect(defined(calibrateSheetOnFace(at(25), 'g1', pistol, { data }).groups[0]).face).toEqual({
      id: face.id,
      event: '25m-standard-pistol',
    })
    // the group's discipline scores on this face too
    const before = { face: { id: 'issf-10m-air-pistol', event: '10m-air-pistol' } }
    expect(
      defined(
        calibrateSheetOnFace(at(100, before), 'g1', pistol, { federation: 'dsb', data }).groups[0],
      ).face,
    ).toEqual({ id: face.id, event: 'dsb-25-m-standardpistole' })
    // one other organization shoots the face at the distance
    const one = {
      ...found,
      federation: 'issf',
      events: [{ id: 'b', distance: 50, federation: 'bds' }],
    }
    expect(defined(calibrateSheetOnFace(at(50), 'g1', one).groups[0]).face).toEqual({
      id: 'f',
      event: 'b',
    })
  })
})
