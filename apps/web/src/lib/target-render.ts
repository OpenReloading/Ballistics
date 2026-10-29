/** The rendered image of a target sheet, loaded on export only. */
import type { Translator } from '../i18n/translate.ts'
import type { ViewBox } from './target-view.ts'

const styleProps = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'paint-order',
  'opacity',
  'font-size',
  'font-family',
  'font-weight',
  'display',
]

/**
 * The SVG as standalone markup: an SVG drawn into a canvas loads no stylesheet, so each element's
 * computed style is written onto it; a stroke that keeps its screen width scales by `k` (view units
 * per px).
 */
function standalone(svg: SVGSVGElement, k: number, size: { w: number; h: number }) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const walk = (a: Element, b: Element) => {
    const cs = getComputedStyle(a)
    const fixed = cs.getPropertyValue('vector-effect') === 'non-scaling-stroke'
    const decl = styleProps.map((p) => {
      const v = cs.getPropertyValue(p)
      if (!fixed || (p !== 'stroke-width' && p !== 'stroke-dasharray') || v === 'none')
        return `${p}:${v}`
      return `${p}:${v.replace(/[\d.]+(px)?/g, (n) => String(Number.parseFloat(n) * k))}`
    })
    b.setAttribute('style', decl.join(';'))
    b.removeAttribute('class')
    b.removeAttribute('vector-effect')
    const copies = [...b.children]
    for (const [i, c] of [...a.children].entries()) {
      const copy = copies[i]
      if (copy) walk(c, copy)
    }
  }
  walk(svg, clone)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(size.w))
  clone.setAttribute('height', String(size.h))
  clone.setAttribute('preserveAspectRatio', 'none')
  return new XMLSerializer().serializeToString(clone)
}

const loaded = async (src: string) => {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

type RenderJob = {
  t: Translator['t']
  photo: { url: string; width: number; height: number } | undefined
  box: ViewBox
  size: { w: number; h: number }
  turn: number
  k: number
}

/** The photo, turned about its middle as on screen, under the overlay SVG, drawn into a canvas. */
export async function renderCanvas({ photo, box, size, turn, k, t }: RenderJob) {
  const svg = document.querySelector('.target-offscreen svg')
  if (!(svg instanceof SVGSVGElement)) throw new Error(t('nothing drawn'))
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const g = canvas.getContext('2d')
  if (!g) throw new Error(t('no canvas'))
  const stage = document.querySelector('.target-stage')
  g.fillStyle = (stage && getComputedStyle(stage).backgroundColor) || '#ffffff'
  g.fillRect(0, 0, size.w, size.h)
  if (photo) {
    const img = await loaded(photo.url)
    const f = size.w / box.w
    // turned about its middle as on screen
    g.translate((photo.width / 2 - box.x) * f, (photo.height / 2 - box.y) * f)
    g.rotate(-turn)
    g.drawImage(
      img,
      (-photo.width / 2) * f,
      (-photo.height / 2) * f,
      photo.width * f,
      photo.height * f,
    )
    g.setTransform(1, 0, 0, 1, 0, 0)
  }
  const markup = standalone(svg, k, size)
  g.drawImage(await loaded(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`), 0, 0)
  return canvas
}
