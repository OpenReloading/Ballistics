import type { TargetFace } from '@openreloading/schema'

type Ring = TargetFace['rings'][number]
type Paint = { fill?: string; stroke?: string; vectorEffect?: 'non-scaling-stroke' }

/**
 * A target face drawn from its record, face mm as SVG units: the paper inside the outer ring, the
 * zones in their recorded colours (else the black area), the ring lines and the inner ten. A ring
 * line on a black zone is white. Paper colours in both themes: it shows the printed face.
 * shortcut: one scoring centre and no sheet; a record with `bulls` or `paper` (none yet) draws its
 * first bull only, draw the sheet once one exists.
 */
export function TargetFaceDrawing({ face }: { face: TargetFace }) {
  const outer = face.rings[0]
  const w = outer.diameter.value
  const h = outer.height?.value ?? w
  const pad = w * 0.02
  const black = face.blackDiameter.value
  const fills = face.rings.some((r) => r.fill)
  // white on the black zone outside the line
  const onBlack = (i: number, d: number) =>
    fills ? face.rings[i - 1]?.fill === 'black' : d <= black
  const line = (i: number, d: number, colour?: string) =>
    colour ?? (onBlack(i, d) ? 'white' : 'black')
  const ellipse = (d: number, height: number | undefined) => ({ rx: d / 2, ry: (height ?? d) / 2 })
  // a ring of a square area is a rectangle, any other an ellipse
  const ring = (r: Ring, paint: Paint) =>
    r.shape === 'square' ? (
      <rect
        key={r.value}
        x={-r.diameter.value / 2}
        y={-r.diameter.value / 2}
        width={r.diameter.value}
        height={r.diameter.value}
        {...paint}
      />
    ) : (
      <ellipse key={r.value} {...ellipse(r.diameter.value, r.height?.value)} {...paint} />
    )
  return (
    <svg
      className="target-face-drawing"
      viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      role="img"
      aria-label={`${face.name}: ${face.rings.length} rings, ${w} mm across`}
    >
      {ring(outer, { fill: 'white' })}
      {fills ? (
        face.rings.map((r) => ring(r, { fill: r.fill ?? 'white' }))
      ) : (
        <ellipse {...ellipse(black, face.blackHeight?.value)} fill="black" />
      )}
      <g fill="none" strokeWidth={1}>
        {face.rings.map((r, i) =>
          ring(r, {
            stroke: line(i, r.diameter.value, r.line),
            vectorEffect: 'non-scaling-stroke',
          }),
        )}
        {face.innerTen && (
          <ellipse
            {...ellipse(face.innerTen.diameter.value, face.innerTen.height?.value)}
            stroke={line(face.rings.length, face.innerTen.diameter.value)}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </g>
    </svg>
  )
}
