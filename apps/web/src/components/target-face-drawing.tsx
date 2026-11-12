'use client'

import type { TargetFace } from '@open-reloading/schema'
import {
  type FaceEllipse,
  type FaceShape,
  targetFaceFigure,
} from '@open-reloading/svg-drawings/target'
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

/** Face mm as SVG units; paper colors in both themes, as it shows the printed face. */
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
        // oxlint-disable-next-line react/no-array-index-key -- a fixed list in drawing order, rings may share a size
        <Outline key={i} e={z} fill={z.colour} />
      ))}
      <g fill="none" strokeWidth={1}>
        {lines.map((l, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- a fixed list in drawing order, rings may share a size
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
