import { beforeEach, expect, it, vi } from 'vitest'
import type { ViewBox } from '../src/lib/target-view.ts'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
// Node has no screen matrix: view units are screen px times `k` from the box's corner
vi.mock('../src/components/svg-point.ts', () => ({
  viewPoint: (svg: { box: ViewBox; k: number } | null, x: number, y: number) =>
    svg && { x: svg.box.x + x * svg.k, y: svg.box.y + y * svg.k },
}))

const { renderHook } = await import('./fake-hooks.ts')
const { usePinch } = await import('../src/components/use-pinch.ts')

type Handler = (e: PointerEvent) => void
let handlers: Map<string, Handler>
let views: ViewBox[]
let cancels: number
const now = { box: { x: 0, y: 0, w: 100, h: 100 }, k: 0.5 }
const svg = {
  ...now,
  addEventListener: (name: string, f: Handler) => handlers.set(name, f),
  removeEventListener: (name: string) => handlers.delete(name),
}

beforeEach(() => {
  handlers = new Map()
  views = []
  cancels = 0
})

function pinch() {
  return renderHook(() =>
    usePinch(
      { current: svg as never },
      now,
      (b) => views.push(b),
      () => cancels++,
    ),
  )
}

/** Sends a pointer event; true when it was stopped at the SVG. */
function send(
  name: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  pointerId: number,
  x: number,
  y: number,
  o: { pointerType?: string; isPrimary?: boolean } = {},
) {
  let stopped = false
  handlers.get(name)?.({
    pointerId,
    clientX: x,
    clientY: y,
    pointerType: 'touch',
    isPrimary: pointerId === 1,
    ...o,
    stopPropagation: () => {
      stopped = true
    },
  } as never)
  return stopped
}

/** The view point under screen point (x, y) in `box`. */
const under = (box: ViewBox, x: number, y: number) => ({
  x: box.x + x * (box.w / 200),
  y: box.y + y * (box.h / 200),
})

it('leaves one finger, a mouse and a pen to the page', () => {
  pinch()
  expect(send('pointerdown', 1, 10, 10)).toBe(false)
  expect(send('pointermove', 1, 20, 20)).toBe(false)
  expect(send('pointerdown', 7, 10, 10, { pointerType: 'mouse', isPrimary: false })).toBe(false)
  expect(views).toEqual([])
  expect(cancels).toBe(0)
})

it('zooms about the point between two fingers and keeps it under them', () => {
  pinch()
  send('pointerdown', 1, 40, 100)
  expect(send('pointerdown', 2, 160, 100)).toBe(true)
  expect(cancels).toBe(1)
  // the fingers spread to twice their distance and move 20 px right together
  expect(send('pointermove', 1, 0, 100)).toBe(true)
  send('pointermove', 2, 240, 100)
  const last = views.at(-1)
  if (!last) throw new Error('no view')
  expect(last.w).toBeCloseTo(50, 9)
  expect(last.h).toBeCloseTo(50, 9)
  // the view point that was between the fingers (100, 100 screen) is under their middle (120, 100)
  const p = under(last, 120, 100)
  expect(p.x).toBeCloseTo(50, 9)
  expect(p.y).toBeCloseTo(50, 9)
})

it('swallows a finger of a pinch until it lifts, also after the other one did', () => {
  pinch()
  send('pointerdown', 1, 40, 100)
  send('pointerdown', 2, 160, 100)
  expect(send('pointerup', 2, 160, 100)).toBe(true)
  const n = views.length
  expect(send('pointermove', 1, 50, 100)).toBe(true)
  expect(views).toHaveLength(n)
  expect(send('pointerup', 1, 50, 100)).toBe(true)
  // a new touch is the page's again
  expect(send('pointerdown', 1, 50, 100)).toBe(false)
})

it('starts a new gesture with a primary touch, dropping touches that ended unseen', () => {
  pinch()
  send('pointerdown', 1, 40, 100)
  send('pointerdown', 2, 160, 100)
  // the lift of both fingers never arrived
  expect(send('pointerdown', 1, 40, 100)).toBe(false)
  expect(send('pointermove', 2, 0, 0)).toBe(false)
  expect(send('pointercancel', 1, 40, 100)).toBe(false)
})

it('takes the third finger into the pinch without a new start', () => {
  pinch()
  send('pointerdown', 1, 40, 100)
  send('pointerdown', 2, 160, 100)
  expect(send('pointerdown', 3, 100, 0, { isPrimary: false })).toBe(true)
  expect(cancels).toBe(1)
  expect(send('pointerup', 3, 100, 0)).toBe(true)
})

it('stops listening when it unmounts', () => {
  pinch().unmount()
  expect(handlers.size).toBe(0)
})
