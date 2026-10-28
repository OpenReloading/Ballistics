'use client'

import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { pointLabels } from '../lib/bullet-photo-canvas.ts'
import type { Point } from '../lib/target-geometry.ts'

/** What a press on the photograph does: place scale points, or brush the bullet in or out. */
export type Tool = 'scale' | 'add' | 'erase'

interface PointerInput {
  size: { width: number; height: number } | undefined
  tool: Tool
  brush: number
  points: Point[]
  setPoints: (update: (all: Point[]) => Point[]) => void
  /** Paints a disc of the brush into the cut-out. */
  stamp: (p: Point, value: 0 | 255, radius: number) => void
}

/** Turns the pointer's place on the canvas into working-image px. */
function toWork(e: PointerEvent<HTMLCanvasElement>): Point {
  const r = e.currentTarget.getBoundingClientRect()
  return {
    x: ((e.clientX - r.left) * e.currentTarget.width) / r.width,
    y: ((e.clientY - r.top) * e.currentTarget.height) / r.height,
  }
}

const arrows: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** The cursor step of a key press, px: Shift one pixel, Control a large step. */
const stepOf = (e: KeyboardEvent) => (e.shiftKey ? 1 : e.ctrlKey || e.metaKey ? 60 : 8)

/**
 * Pointer, touch and key handling of the photograph canvas: a press places or drags a scale point
 * or paints with the brush, the arrow keys move a cursor and Enter does what a press does. `heard`
 * is the line a screen reader gets for a key action.
 */
export function usePhotoPointer({ size, tool, brush, points, setPoints, stamp }: PointerInput) {
  const [cursor, setCursor] = useState<Point>()
  const { t } = useTranslation()
  const [heard, setHeard] = useState('')
  const dragging = useRef<number | undefined>(undefined)
  const painting = useRef(false)

  /** Moves the point within reach of `p`, else adds one; the fifth takes the nearest of the four. Returns its index. */
  const place = (p: Point, reach: number) => {
    const near = points
      .map((q, i) => ({ i, d: Math.hypot(q.x - p.x, q.y - p.y) }))
      .sort((a, b) => a.d - b.d)[0]
    const i = near && (near.d <= reach || points.length >= 4) ? near.i : points.length
    setPoints((all) => (i < all.length ? all.map((q, k) => (k === i ? p : q)) : [...all, p]))
    setHeard(t('Point {point} placed.', { point: pointLabels[i] ?? '' }))
    return i
  }
  const paint = (p: Point) => stamp(p, tool === 'add' ? 255 : 0, brush)

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !size) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toWork(e)
    setCursor(p)
    if (tool === 'scale') {
      const reach = (18 * size.width) / e.currentTarget.getBoundingClientRect().width
      dragging.current = place(p, reach)
    } else {
      painting.current = true
      paint(p)
    }
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = toWork(e)
    setCursor(p)
    const i = dragging.current
    if (i !== undefined) setPoints((all) => all.map((q, k) => (k === i ? p : q)))
    else if (painting.current) paint(p)
  }
  const up = () => {
    dragging.current = undefined
    painting.current = false
  }

  const act = (here: Point) => {
    if (tool === 'scale') return void place(here, 24)
    paint(here)
    setHeard(tool === 'add' ? t('Added to the bullet.') : t('Erased from the bullet.'))
  }
  const keys = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!size) return
    const here = cursor ?? { x: size.width / 2, y: size.height / 2 }
    const [dx, dy] = arrows[e.key] ?? [0, 0]
    if (dx || dy) {
      e.preventDefault()
      const step = stepOf(e)
      setCursor({
        x: Math.min(size.width, Math.max(0, here.x + dx * step)),
        y: Math.min(size.height, Math.max(0, here.y + dy * step)),
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      act(here)
    }
  }

  return { cursor, heard, down, move, up, leave: () => setCursor(undefined), keys }
}
