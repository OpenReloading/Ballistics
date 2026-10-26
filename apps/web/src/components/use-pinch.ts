import { type RefObject, useEffect, useRef } from 'react'
import { nth } from '../lib/nth.ts'
import { pinchView, type ViewBox } from '../lib/target-view.ts'
import { viewPoint } from './svg-point.ts'

type Pt = { x: number; y: number }

type Latest = {
  now: { box: ViewBox; k: number }
  setView: (b: ViewBox) => void
  cancel: () => void
}

type PinchState = {
  touches: Map<number, Pt>
  /** The fingers of a pinch: their events stop here until they lift. */
  pinched: Set<number>
  start: { box: ViewBox; k: number; p: Pt; m0: Pt; d0: number } | undefined
}

/** The middle and the distance of the first two touches. */
function pair(touches: Map<number, Pt>) {
  const both = [...touches.values()]
  const [a, b] = [nth(both, 0), nth(both, 1)]
  return { m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) }
}

function pinchDown(
  st: PinchState,
  el: SVGSVGElement,
  latest: { current: Latest },
  e: PointerEvent,
) {
  if (e.pointerType !== 'touch') return
  // a primary touch starts a new gesture: touches that ended unseen are dropped
  if (e.isPrimary) {
    st.touches.clear()
    st.pinched.clear()
    st.start = undefined
  }
  st.touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (st.touches.size < 2) return
  e.stopPropagation()
  for (const id of st.touches.keys()) st.pinched.add(id)
  if (st.start) return
  latest.current.cancel()
  const { m, d } = pair(st.touches)
  const p = viewPoint(el, m.x, m.y)
  if (!p) return
  st.start = { ...latest.current.now, p, m0: m, d0: d || 1 }
}

function pinchMove(st: PinchState, latest: { current: Latest }, e: PointerEvent) {
  if (!st.touches.has(e.pointerId)) return
  st.touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (st.pinched.has(e.pointerId)) e.stopPropagation()
  if (!st.start) return
  const { start } = st
  const { m, d } = pair(st.touches)
  latest.current.setView(pinchView(start.box, start.k, start.p, start.m0, m, start.d0 / (d || 1)))
}

function pinchUp(st: PinchState, e: PointerEvent) {
  st.touches.delete(e.pointerId)
  if (st.pinched.delete(e.pointerId)) e.stopPropagation()
  if (st.touches.size < 2) st.start = undefined
}

/**
 * Two-finger zoom and pan on an SVG view: while two touches are down the view follows them
 * (`pinchView`), and their pointer events stop at the SVG, so the page's handlers see no drag or
 * tap; a finger of a pinch stays swallowed until it lifts, also after the other one did. The second
 * touch calls `cancel`, which drops what the first one started.
 */
export function usePinch(
  svg: RefObject<SVGSVGElement | null>,
  now: { box: ViewBox; k: number },
  setView: (b: ViewBox) => void,
  cancel: () => void,
) {
  const latest = useRef({ now, setView, cancel })
  latest.current = { now, setView, cancel }
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const st: PinchState = { touches: new Map(), pinched: new Set(), start: undefined }
    const down = (e: PointerEvent) => pinchDown(st, el, latest, e)
    const move = (e: PointerEvent) => pinchMove(st, latest, e)
    const up = (e: PointerEvent) => pinchUp(st, e)
    const opts = { capture: true }
    el.addEventListener('pointerdown', down, opts)
    el.addEventListener('pointermove', move, opts)
    el.addEventListener('pointerup', up, opts)
    el.addEventListener('pointercancel', up, opts)
    return () => {
      el.removeEventListener('pointerdown', down, opts)
      el.removeEventListener('pointermove', move, opts)
      el.removeEventListener('pointerup', up, opts)
      el.removeEventListener('pointercancel', up, opts)
    }
  }, [svg])
}
