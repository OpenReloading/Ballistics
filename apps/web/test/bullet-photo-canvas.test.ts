import { describe, expect, it } from 'vitest'
import { paintPhoto, tintBox, tintOf, type View } from '../src/lib/bullet-photo-canvas.ts'

type Call = [string, ...unknown[]]

/** A 2D context that records its method calls and keeps the image data put into it. */
function context() {
  const calls: Call[] = []
  const put: { data: Uint8ClampedArray; width: number; x: number; y: number }[] = []
  const g = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'createImageData')
        return (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(4 * w * h),
        })
      if (key === 'putImageData')
        return (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) =>
          put.push({ data: img.data, width: img.width, x, y })
      return (...args: unknown[]) => calls.push([String(key), ...args])
    },
  })
  return { g: g as unknown as CanvasRenderingContext2D, calls, put }
}

const canvas = (g?: CanvasRenderingContext2D, width = 900, height = 600) =>
  ({ width, height, getContext: () => g ?? null }) as unknown as HTMLCanvasElement

describe('tint', () => {
  it('tints each pixel at 40 % of its cut-out alpha, placed at the box', () => {
    const { g, put } = context()
    // a 3 x 2 cut-out, row by row
    const alpha = Uint8Array.from([0, 255, 100, 50, 0, 255])
    tintBox(alpha, 3, canvas(g), [1, 0, 2, 1])
    expect(put).toHaveLength(1)
    const [img] = put
    expect([img?.x, img?.y, img?.width]).toEqual([1, 0, 2])
    expect(Array.from(img?.data ?? [])).toEqual([
      ...[214, 51, 132, 102],
      ...[214, 51, 132, 40],
      ...[214, 51, 132, 0],
      ...[214, 51, 132, 102],
    ])
  })

  it('sizes the tint canvas to the image and tints all of it', () => {
    const { g, put } = context()
    const into = canvas(g, 0, 0)
    tintOf(new Uint8Array(6).fill(255), 3, 2, into)
    expect([into.width, into.height]).toEqual([3, 2])
    expect(put[0]?.data.length).toBe(4 * 6)
  })

  it('draws nothing without a 2D context', () => {
    expect(() => tintBox(new Uint8Array(1), 1, canvas(), [0, 0, 0, 0])).not.toThrow()
  })
})

describe('paintPhoto', () => {
  const view = (over: Partial<View> = {}): View => ({
    hasCut: false,
    outline: undefined,
    drawing: undefined,
    opacity: 0.6,
    points: [],
    cursor: undefined,
    brush: undefined,
    ...over,
  })
  const names = (calls: Call[]) => calls.map((c) => c[0])

  it('draws the tint over the photograph only once there is a cut-out', () => {
    const photo = canvas()
    const tint = canvas()
    const plain = context()
    paintPhoto(plain.g, photo, tint, view())
    expect(plain.calls.filter((c) => c[0] === 'drawImage').map((c) => c[1])).toEqual([photo])
    const cut = context()
    paintPhoto(cut.g, photo, tint, view({ hasCut: true }))
    expect(cut.calls.filter((c) => c[0] === 'drawImage').map((c) => c[1])).toEqual([photo, tint])
  })

  it('labels the scale points A to D in order', () => {
    const { g, calls } = context()
    const points = [0, 1, 2, 3].map((i) => ({ x: 100 * i, y: 50 }))
    paintPhoto(g, canvas(), canvas(), view({ points }))
    expect(calls.filter((c) => c[0] === 'fillText').map((c) => c[1])).toEqual(['A', 'B', 'C', 'D'])
  })

  it("rings the cursor at the brush's radius, else 5 px scaled to the photograph", () => {
    const at = (brush: number | undefined, width: number) => {
      const { g, calls } = context()
      paintPhoto(g, canvas(undefined, width), canvas(), view({ cursor: { x: 10, y: 20 }, brush }))
      return calls.find((c) => c[0] === 'arc')?.slice(1, 4)
    }
    expect(at(12, 900)).toEqual([10, 20, 12])
    expect(at(undefined, 900)).toEqual([10, 20, 5])
    expect(at(undefined, 1800)).toEqual([10, 20, 10])
  })

  it('lays the drawing along the axis only with an outline, both halves closed', () => {
    const outline = { origin: { x: 100, y: 200 }, angle: 0, length: 300 }
    const drawing = {
      points: [
        [0, 0],
        [2, 5],
      ] as [number, number][],
      pxPerMm: 10,
    }
    const without = context()
    paintPhoto(without.g, canvas(), canvas(), view({ drawing }))
    expect(names(without.calls)).not.toContain('closePath')
    const { g, calls } = context()
    paintPhoto(g, canvas(), canvas(), view({ outline: outline as View['outline'], drawing }))
    // after the axis (two calls, stroked twice), the first pass of the drawing
    const path = calls.filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo').slice(4, 8)
    expect(path).toEqual([
      ['moveTo', 100, 200],
      ['lineTo', 150, 220],
      ['lineTo', 150, 180],
      ['lineTo', 100, 200],
    ])
    expect(names(calls)).toContain('closePath')
  })
})
