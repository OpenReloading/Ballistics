'use client'

import { fromSi, toSi } from '@open-reloading/schema'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Design, evaluate } from '../lib/bullet-designer.ts'
import { paintDisc, type ScaleSpan, scaleOf } from '../lib/bullet-photo.ts'
import { tintBox, tintOf } from '../lib/bullet-photo-canvas.ts'
import { photoDesign, photoRows } from '../lib/bullet-photo-design.ts'
import type { BulletMeasurement } from '../lib/bullet-photo-measure.ts'
import type { Outline } from '../lib/bullet-photo-outline.ts'
import type { WorkerReply, WorkerRequest } from '../lib/bullet-photo-protocol.ts'
import { samplePhoto } from '../lib/bullet-photo-sample.ts'
import { errorText } from '../lib/error-text.ts'
import { type FieldSpec, type FieldValue, fieldOf } from '../lib/field-spec.ts'
import type { Point } from '../lib/target-geometry.ts'
import type { UnitSystem } from '../lib/units.ts'

/** The longer side of the working image, px: a larger photograph is shrunk to it while it is read. */
const workLong = 2400

/** The ruler's distance between two placed points. */
export const distanceSpec = (label: string): FieldSpec => ({
  key: label,
  label,
  quantity: 'length',
  positive: true,
})

const empty: FieldValue = { text: '', si: undefined }

type Without<T> = T extends unknown ? Omit<T, 'id'> : never

/** Asks the worker of the tool; one worker for the life of the dialog, an answer matched by its request id. */
function useWorker(onError: (message: string) => void) {
  const worker = useRef<Worker | undefined>(undefined)
  const waiting = useRef(new Map<number, (r: WorkerReply) => void>())
  const sequence = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('../lib/bullet-photo.worker.ts', import.meta.url), {
      type: 'module',
    })
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      waiting.current.get(e.data.id)?.(e.data)
      waiting.current.delete(e.data.id)
    }
    w.onerror = () => onError('The photograph could not be processed in this browser.')
    worker.current = w
    return () => w.terminate()
  }, [onError])
  return useCallback(
    (request: Without<WorkerRequest>, transfer: Transferable[] = []) =>
      new Promise<WorkerReply>((resolve) => {
        const id = ++sequence.current
        waiting.current.set(id, resolve)
        worker.current?.postMessage({ ...request, id }, transfer)
      }),
    [],
  )
}

/** The cut-out: its coverage and a count of the changes made to it. */
export interface Cut {
  alpha: Uint8Array
  rev: number
}

interface Found {
  outline?: Outline
  measurement?: BulletMeasurement
}

/**
 * The state of the bullet photo tool: the working photograph, the scale points, the cut-out, the
 * outline and measurement the worker returns, and what they become in the designer. The photograph
 * and its tint live in canvases kept in refs, outside React state.
 */
export function useBulletPhoto(system: UnitSystem, record: Design['origin']) {
  const photo = useRef<HTMLCanvasElement | null>(null)
  const tint = useRef<HTMLCanvasElement | null>(null)
  const edited = useRef(false)
  const [size, setSize] = useState<{ width: number; height: number }>()
  const [cut, setCut] = useState<Cut>()
  const [points, setPoints] = useState<Point[]>([])
  const [distances, setDistances] = useState<[FieldValue, FieldValue]>([empty, empty])
  const [axis, setAxis] = useState<number>()
  const [found, setFound] = useState<Found>()
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const ask = useWorker(setFailure)

  const scale = useMemo(() => {
    const spans = [0, 1].flatMap((i): ScaleSpan[] => {
      const [a, b, si] = [points[2 * i], points[2 * i + 1], distances[i]?.si]
      return a && b && si !== undefined && si > 0 ? [{ a, b, mm: fromSi('length', si) }] : []
    })
    return scaleOf(spans)
  }, [points, distances])

  const cutOut = useCallback(
    async (exclude: Point[]) => {
      if (!(size && tint.current)) return
      setBusy('Cutting out the bullet…')
      const r = await ask({ kind: 'segment', exclude })
      setBusy(undefined)
      if (r.kind === 'error') return setFailure(r.message)
      if (r.kind !== 'segmented' || !tint.current) return
      tintOf(r.alpha, size.width, size.height, tint.current)
      edited.current = false
      setWarnings(r.warnings)
      setCut((c) => ({ alpha: r.alpha, rev: (c?.rev ?? 0) + 1 }))
    },
    [ask, size],
  )

  // the scale points keep the ruler out of the cut-out: cut again when they move, unless the cut-out was corrected by hand
  useEffect(() => {
    if (!size || edited.current) return
    const t = setTimeout(() => void cutOut(points), 250)
    return () => clearTimeout(t)
  }, [size, points, cutOut])

  // outline and measure after each change of the cut-out, the scale or the axis
  useEffect(() => {
    if (!(cut && size)) return
    let stale = false
    const t = setTimeout(async () => {
      const r = await ask({
        kind: 'measure',
        alpha: cut.alpha.slice(),
        width: size.width,
        height: size.height,
        scale: scale ?? { pxPerMm: 1, relUncertainty: 0 },
        angle: axis,
      })
      if (stale) return
      if (r.kind === 'error') setFailure(r.message)
      if (r.kind === 'measured')
        setFound({
          ...(r.outline && { outline: r.outline }),
          ...(r.measurement && { measurement: r.measurement }),
        })
    }, 150)
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [ask, cut, size, scale, axis])

  /** Takes a canvas as the working photograph: its pixels go to the worker, the state starts over. */
  const adopt = async (canvas: HTMLCanvasElement, span?: ScaleSpan) => {
    const data = canvas
      .getContext('2d', { willReadFrequently: true })
      ?.getImageData(0, 0, canvas.width, canvas.height)
    if (!data) return setFailure('This browser cannot read the photograph.')
    const buffer = data.data.buffer as ArrayBuffer
    const r = await ask(
      { kind: 'load', width: canvas.width, height: canvas.height, data: buffer },
      [buffer],
    )
    if (r.kind === 'error') return setFailure(r.message)
    photo.current = canvas
    tint.current = document.createElement('canvas')
    edited.current = false
    setCut(undefined)
    setFound(undefined)
    setAxis(undefined)
    setWarnings([])
    setPoints(span ? [span.a, span.b] : [])
    setDistances([
      span ? fieldOf(system, distanceSpec('Distance A to B'), toSi('length', span.mm)) : empty,
      empty,
    ])
    setSize({ width: canvas.width, height: canvas.height })
  }

  const run = async (busyText: string, work: () => Promise<void>) => {
    setFailure(undefined)
    setBusy(busyText)
    try {
      await work()
    } catch (err) {
      setFailure(errorText(err))
    }
    setBusy(undefined)
  }

  /** Reads a photograph file, shrunk to the working size. */
  const read = (file: File | null) =>
    file &&
    run('Reading the photograph…', async () => {
      const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error('This file is not an image this browser can read.')
      })
      const k = Math.min(1, workLong / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * k)
      canvas.height = Math.round(bitmap.height * k)
      const g = canvas.getContext('2d')
      if (!g) throw new Error('This browser cannot read the photograph.')
      g.imageSmoothingQuality = 'high'
      g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      await adopt(canvas)
    })

  /** The synthetic sample photograph, with its ruler span placed. */
  const sample = () =>
    run('Making the sample photograph…', async () => {
      const { image, span } = samplePhoto()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas
        .getContext('2d')
        ?.putImageData(new ImageData(image.data.slice(), image.width, image.height), 0, 0)
      if (span) await adopt(canvas, span)
    })

  /** Paints a disc of the brush into the cut-out, by hand: the automatic cut stops redoing it. */
  const stamp = (p: Point, value: 0 | 255, radius: number) => {
    if (!(cut && size && tint.current)) return
    paintDisc({ ...size, alpha: cut.alpha, warnings: [] }, p, radius, value)
    const box: [number, number, number, number] = [
      Math.max(0, Math.floor(p.x - radius)),
      Math.max(0, Math.floor(p.y - radius)),
      Math.min(size.width - 1, Math.ceil(p.x + radius)),
      Math.min(size.height - 1, Math.ceil(p.y + radius)),
    ]
    tintBox(cut.alpha, size.width, tint.current, box)
    edited.current = true
    setCut({ alpha: cut.alpha, rev: cut.rev + 1 })
  }

  const facts = useMemo(() => (size && scale ? { ...size, scale } : undefined), [size, scale])
  const design = useMemo(
    () => (found?.measurement && facts ? photoDesign(found.measurement, facts, system) : undefined),
    [found, facts, system],
  )
  const drawing = useMemo(
    () => (design ? evaluate(design, system).drawing : undefined),
    [design, system],
  )
  const rows = useMemo(
    () => (found?.measurement && facts ? photoRows(found.measurement, record?.si) : []),
    [found, facts, record],
  )

  return {
    photo,
    tint,
    size,
    cut,
    points,
    setPoints,
    distances,
    setDistances,
    scale,
    axis,
    setAxis,
    found,
    warnings,
    busy,
    failure,
    design,
    drawing,
    rows,
    read,
    sample,
    stamp,
    cutAgain: () => void cutOut(points),
    edited,
  }
}
