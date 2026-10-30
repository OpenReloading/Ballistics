// The printed zero target as a luminance function of sheet mm, read from the SVG markup itself, so a
// synthetic photo shows what the sheet prints. Text is drawn as one outlined box per character.
import { type FieldValues, fieldKeys, zeroTargetSvg } from '../src/lib/zero-target.ts'

const PAPER = 225
const lum = (colour: string) => (colour === '#fff' ? PAPER : colour === '#000' ? 35 : 150)

type Ink = (x: number, y: number) => number | undefined

const attrs = (tag: string) =>
  Object.fromEntries([...tag.matchAll(/(?<![\w-])([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
const num = (a: Record<string, string | undefined>, k: string) => Number(a[k] ?? 0)

/** The sheet's text in English, the fields filled from `values`, else blank. */
export function sheetSvg(values?: Partial<FieldValues>) {
  const blank = Object.fromEntries(fieldKeys.map((k) => [k, ''])) as FieldValues
  return zeroTargetSvg({
    labels: {
      rifle: 'Rifle',
      date: 'Date',
      caliber: 'Caliber',
      shooter: 'Shooter',
      distance: 'Distance (m)',
      group: 'Group',
    },
    values: { ...blank, ...values },
    check: 'Print at 100 %, not fitted to the page. Check the bar with a ruler.',
    footer: 'Zero target zero-a4, version 1, plain corner marks, 160 x 240 mm, grid 10 mm',
    plus: '+5 cm',
    minus: '-5 cm',
  })
}

/** One outlined box per character, the width of a sans-serif glyph. */
function textInk(a: Record<string, string | undefined>, content: string): Ink {
  const size = num(a, 'font-size')
  const [w, h, stroke] = [0.55 * size, 0.7 * size, 0.1 * size]
  const text = content.replace(/&\w+;/g, '_')
  const x0 = num(a, 'x') - (a['text-anchor'] === 'middle' ? (text.length * w) / 2 : 0)
  const [top, base] = [num(a, 'y') - h, num(a, 'y')]
  const v = lum(a.fill ?? '#000')
  return (px: number, py: number) => {
    if (py < top || py > base || px < x0 || px > x0 + text.length * w) return
    const i = Math.floor((px - x0) / w)
    if (text[i] === ' ') return
    const gx = px - x0 - i * w
    const box = gx < stroke || (gx > w - 2 * stroke && gx < w - stroke)
    return box || py - top < stroke || base - py < stroke ? v : undefined
  }
}

/** Luminance (0..255) of the printed sheet at (x, y) mm, y down from the top left. */
export function sheetInk(svg: string): (x: number, y: number) => number {
  const inks: Ink[] = []
  // the page's white background is the paper
  for (const m of [...svg.matchAll(/<(rect|line|circle|text)\b([^>]*)>([^<]*)/g)].slice(1)) {
    const [, kind, tag = '', content = ''] = m
    const a = attrs(tag)
    if (kind === 'rect') {
      const [x, y, w, h, v] = [
        num(a, 'x'),
        num(a, 'y'),
        num(a, 'width'),
        num(a, 'height'),
        lum(a.fill ?? ''),
      ]
      inks.push((px, py) => (px >= x && px <= x + w && py >= y && py <= y + h ? v : undefined))
    } else if (kind === 'line') {
      const [x1, y1, x2, y2] = [num(a, 'x1'), num(a, 'y1'), num(a, 'x2'), num(a, 'y2')]
      const half = num(a, 'stroke-width') / 2
      const v = lum(a.stroke ?? '')
      const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
      inks.push((px, py) => {
        const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / len2))
        return Math.hypot(px - x1 - t * (x2 - x1), py - y1 - t * (y2 - y1)) <= half ? v : undefined
      })
    } else if (kind === 'circle') {
      const [cx, cy, r, half] = [
        num(a, 'cx'),
        num(a, 'cy'),
        num(a, 'r'),
        num(a, 'stroke-width') / 2,
      ]
      inks.push((px, py) => (Math.abs(Math.hypot(px - cx, py - cy) - r) <= half ? 35 : undefined))
    } else inks.push(textInk(a, content))
  }
  return (x, y) => {
    let v = PAPER
    for (const ink of inks) v = ink(x, y) ?? v
    return v
  }
}
