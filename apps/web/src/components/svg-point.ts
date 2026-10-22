/** Screen directions of the arrow keys as unit steps, y down. */
export const arrows: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** A client (screen) point in the view units of `svg`; undefined while it has no screen matrix. */
export function viewPoint(svg: SVGGraphicsElement | null | undefined, x: number, y: number) {
  const m = svg?.getScreenCTM()
  if (!m) return
  const p = new DOMPoint(x, y).matrixTransform(m.inverse())
  return { x: p.x, y: p.y }
}
