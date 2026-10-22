import { type RefObject, useEffect, useRef } from 'react'
import { pinchView, type ViewBox } from '../lib/target-view.ts'
import { viewPoint } from './svg-point.ts'

type Pt = { x: number; y: number }

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
    const touches = new Map<number, Pt>()
    /** The fingers of a pinch: their events stop here until they lift. */
    const pinched = new Set<number>()
    let start: { box: ViewBox; k: number; p: Pt; m0: Pt; d0: number } | undefined
    const pair = () => {
      const [a, b] = [...touches.values()]
      return { m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      // a primary touch starts a new gesture: touches that ended unseen are dropped
      if (e.isPrimary) {
        touches.clear()
        pinched.clear()
        start = undefined
      }
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size < 2) return
      e.stopPropagation()
      for (const id of touches.keys()) pinched.add(id)
      if (start) return
      latest.current.cancel()
      const { m, d } = pair()
      const p = viewPoint(el, m.x, m.y)
      if (!p) return
      start = { ...latest.current.now, p, m0: m, d0: d || 1 }
    }
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinched.has(e.pointerId)) e.stopPropagation()
      if (!start) return
      const { m, d } = pair()
      latest.current.setView(
        pinchView(start.box, start.k, start.p, start.m0, m, start.d0 / (d || 1)),
      )
    }
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      if (pinched.delete(e.pointerId)) e.stopPropagation()
      if (touches.size < 2) start = undefined
    }
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
