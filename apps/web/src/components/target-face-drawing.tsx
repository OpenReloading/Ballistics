import { type FaceEllipse, type FaceShape, targetFaceFigure } from '@openreloading/drawing/target'
import type { TargetFace } from '@openreloading/schema'

type Paint = { fill?: string; stroke?: string; vectorEffect?: 'non-scaling-stroke' }

// a square ring is a rectangle, any other an ellipse
const Outline = ({ e, ...paint }: { e: FaceEllipse } & Paint) =>
  e.square ? (
    <rect x={-e.rx} y={-e.ry} width={2 * e.rx} height={2 * e.ry} {...paint} />
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
export const TargetFaceDrawing = ({ face }: { face: TargetFace }) => (
  <TargetFaceFigure
    shape={face}
    label={`${face.name}: ${face.rings.length} rings, ${face.rings[0].diameter.value} mm across`}
  />
)
