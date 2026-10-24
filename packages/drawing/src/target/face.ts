/** A length in mm, as the quantity objects of a target face record carry it. */
export interface FaceLength {
  value: number
}

/** The ring fields the face figure reads; a `TargetFace` record fits. */
export interface FaceRing {
  value: number
  diameter: FaceLength
  /** Height of an oval ring; absent: a circle. */
  height?: FaceLength
  fill?: string
  line?: string
}

/** The fields of a target face the figure reads; a `TargetFace` record fits. */
export interface FaceShape {
  /** Outer to inner. */
  rings: FaceRing[]
  innerTen?: { diameter: FaceLength; height?: FaceLength }
  blackDiameter: FaceLength
  blackHeight?: FaceLength
}

/** An ellipse centred on the scoring centre, radii in mm. */
export interface FaceEllipse {
  rx: number
  ry: number
  /** Ring value of the ring the ellipse is drawn for; absent for the paper, the black area and the inner ten. */
  ring?: number
  /** A colour name of the face record, or `white` and `black`. */
  colour: string
}

/** The face as ellipses in drawing order, with the frame around it. */
export interface FaceFigure {
  /** Frame in mm: the outer ring and a margin. */
  frame: { x: number; y: number; width: number; height: number }
  /** Paper inside the outer ring, then the coloured zones (or the black area), filled. */
  zones: FaceEllipse[]
  /** Ring lines outer to inner, then the inner ten, stroked. */
  lines: FaceEllipse[]
}

const ellipse = (d: number, height: number | undefined, colour: string, ring?: number) => ({
  rx: d / 2,
  ry: (height ?? d) / 2,
  colour,
  ...(ring !== undefined && { ring }),
})

/**
 * A target face laid out from its record: the paper inside the outer ring, the zones in their
 * recorded colours (else the black area), the ring lines and the inner ten. Radii are the half
 * of the recorded diameters and heights. A ring line on a black zone is white, else black or the
 * ring's own line colour.
 * shortcut: one scoring centre and no sheet; a record with `bulls` or `paper` draws its first
 * bull only, draw the sheet once a record has one.
 */
export function targetFaceFigure(face: FaceShape): FaceFigure {
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
  const inner = face.innerTen
  return {
    frame: { x: -w / 2 - pad, y: -h / 2 - pad, width: w + 2 * pad, height: h + 2 * pad },
    zones: [
      ellipse(w, outer.height?.value, 'white'),
      ...(fills
        ? face.rings.map((r) =>
            ellipse(r.diameter.value, r.height?.value, r.fill ?? 'white', r.value),
          )
        : [ellipse(black, face.blackHeight?.value, 'black')]),
    ],
    lines: [
      ...face.rings.map((r, i) =>
        ellipse(r.diameter.value, r.height?.value, line(i, r.diameter.value, r.line), r.value),
      ),
      ...(inner
        ? [
            ellipse(
              inner.diameter.value,
              inner.height?.value,
              line(face.rings.length, inner.diameter.value),
            ),
          ]
        : []),
    ],
  }
}
