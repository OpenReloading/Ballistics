import { type FaceShape, targetFaceFigure } from '@openreloading/drawing/target'
import type { TargetFace } from '@openreloading/schema'

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
        <ellipse key={i} rx={z.rx} ry={z.ry} fill={z.colour} />
      ))}
      <g fill="none" strokeWidth={1}>
        {lines.map((l, i) => (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list in drawing order, rings may share a size
            key={i}
            rx={l.rx}
            ry={l.ry}
            stroke={l.colour}
            vectorEffect="non-scaling-stroke"
          />
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
