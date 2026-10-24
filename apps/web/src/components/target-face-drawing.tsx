import { targetFaceFigure } from '@openreloading/drawing/target'
import type { TargetFace } from '@openreloading/schema'

/**
 * A target face drawn from its record by `targetFaceFigure`, face mm as SVG units. Paper colours
 * in both themes: it shows the printed face.
 */
export function TargetFaceDrawing({ face }: { face: TargetFace }) {
  const { frame, zones, lines } = targetFaceFigure(face)
  const w = face.rings[0].diameter.value
  return (
    <svg
      className="target-face-drawing"
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      role="img"
      aria-label={`${face.name}: ${face.rings.length} rings, ${w} mm across`}
    >
      {zones.map((z) => (
        <ellipse key={`${z.ring}-${z.rx}`} rx={z.rx} ry={z.ry} fill={z.colour} />
      ))}
      <g fill="none" strokeWidth={1}>
        {lines.map((l) => (
          <ellipse
            key={`${l.ring}-${l.rx}`}
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
