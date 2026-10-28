'use client'

import { type FaceEllipse, type FaceShape, targetFaceFigure } from '@open-reloading/drawing/target'
import type { TargetFace } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'

type Paint = {
  fill?: string | undefined
  stroke?: string | undefined
  vectorEffect?: 'non-scaling-stroke' | undefined
}

// a square ring is a rectangle, a stadium a rectangle with half circle ends, any other an ellipse
const Outline = ({ e, ...paint }: { e: FaceEllipse } & Paint) =>
  e.square || e.stadium ? (
    <rect
      x={-e.rx}
      y={-e.ry}
      width={2 * e.rx}
      height={2 * e.ry}
      {...(e.stadium && { rx: e.rx })}
      {...paint}
    />
  ) : (
    <ellipse rx={e.rx} ry={e.ry} {...paint} />
  )

/**
 * A face drawn from `targetFaceFigure`, face mm as SVG units. Paper colours in both themes: it
 * shows the printed face.
 */
export function TargetFaceFigure({ shape, label }: { shape: FaceShape; label: string }) {
  const { frame, zones, lines } = targetFaceFigure(shape)
  return (
    <svg
      className="target-face-drawing"
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      role="img"
      aria-label={label}
    >
      {zones.map((z, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list in drawing order, rings may share a size
        <Outline key={i} e={z} fill={z.colour} />
      ))}
      <g fill="none" strokeWidth={1}>
        {lines.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list in drawing order, rings may share a size
          <Outline key={i} e={l} stroke={l.colour} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  )
}

/** A target face record drawn, named by its rings and width. */
export function TargetFaceDrawing({ face }: { face: TargetFace }) {
  const { tn } = useTranslation()
  return (
    <TargetFaceFigure
      shape={face}
      label={tn(
        face.rings.length,
        '{name}: {count} ring, {width} mm across',
        '{name}: {count} rings, {width} mm across',
        { name: face.name, width: face.rings[0]?.diameter.value ?? 0 },
      )}
    />
  )
}
