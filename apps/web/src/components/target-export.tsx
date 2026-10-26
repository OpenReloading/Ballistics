'use client'

import { ActionIcon, Button, Menu } from '@mantine/core'
import type { ShotGroup } from '@open-reloading/schema'
import { Export } from '@phosphor-icons/react'
import { type ReactNode, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import { readouts, statLines } from '../lib/group-readouts.ts'
import { groupStatisticsOf } from '../lib/target-groups.ts'
import { exportSize, type ViewBox } from '../lib/target-view.ts'
import type { UnitSystem } from '../lib/units.ts'
import { recordFileName } from '../lib/user-file-names.ts'
import { storedPhoto } from '../lib/user-store.ts'

/** The extent Fit shows (the whole photo): exports and print use it, never the zoom. */
export type ViewRef = { current: { extent: ViewBox } | undefined }
/** A still canvas of the sheet at view `box`, `k` view units per px, without the photo. */
export type StillCanvas = (box: ViewBox, k: number) => ReactNode

/** The key readouts of every group with shots as an SVG box at the top left of `box`. */
export function StatsBlock({
  groups,
  system,
  box,
  k,
  score,
}: {
  groups: ShotGroup[]
  system: UnitSystem
  box: ViewBox
  k: number
  /** A group's ring score as one line, when it has a face. */
  score?: (g: ShotGroup) => string | undefined
}) {
  const lines = groups.flatMap((g): { text: string; colour?: string }[] => {
    const s = groupStatisticsOf(g)
    if (!s.shotCount) return []
    return [
      { text: g.name, colour: g.colour },
      ...statLines(s, readouts(s, g.distance), system).map((text) => ({ text })),
      ...(score?.(g) ? [{ text: `Score ${score(g)}` }] : []),
    ]
  })
  if (!lines.length) return null
  const font = 12 * k
  const pad = 4 * k
  const w = Math.max(...lines.map((l) => l.text.length)) * 0.6 * font + 2 * pad
  const x = box.x + 8 * k
  const y = box.y + 8 * k
  return (
    <g>
      <rect
        className="note-box"
        x={x}
        y={y}
        width={w}
        height={lines.length * 1.25 * font + 2 * pad}
      />
      <text className="note-text" x={x + pad} y={y + pad} fontSize={font}>
        {lines.map((l, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines keep their order
          <tspan key={i} x={x + pad} dy={i === 0 ? font : 1.25 * font} fill={l.colour}>
            {l.text}
          </tspan>
        ))}
      </text>
    </g>
  )
}

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

export const extension = (type: string) =>
  type === 'image/jpeg' ? 'jpg' : (type.split('/')[1]?.replace(/\W[\s\S]*/, '') ?? 'img')

type RenderJob = {
  photo: { url: string; width: number; height: number } | undefined
  box: ViewBox
  size: { w: number; h: number }
  turn: number
  k: number
}

/** The photo, turned about its middle as on screen, under the overlay SVG, drawn into a canvas. */
async function renderCanvas({ photo, box, size, turn, k }: RenderJob) {
  const svg = document.querySelector('.target-offscreen svg')
  if (!(svg instanceof SVGSVGElement)) throw new Error('nothing drawn')
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const g = canvas.getContext('2d')
  if (!g) throw new Error('no canvas')
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

/**
 * The Export menu: the original photo as stored, the rendered image of the fitted view at
 * the photo's pixel size, and the print sheet. Everything is made in the browser and downloaded;
 * nothing is sent.
 */
export function ExportMenu({
  name,
  photoId,
  photo,
  turn = 0,
  view,
  still,
  onPrint,
  onMessage,
  text,
}: {
  name: string
  photoId?: string | undefined
  /** The shown photo; undefined for a drawn target or a missing photo. */
  photo?: { url: string; width: number; height: number } | undefined
  /** The photo's turn on screen, rad counter-clockwise (`photoRotation`). */
  turn?: number | undefined
  view: ViewRef
  still: StillCanvas
  /** Print sheet as a menu item; on /groups the page bar has its own Print button instead. */
  onPrint?: (() => void) | undefined
  onMessage: (text: string, alert?: boolean) => void
  /** A text button the size of File (the page bar), else a toolbar icon. */
  text?: boolean
}) {
  const [job, setJob] = useState<{ box: ViewBox; k: number }>()
  const stem = recordFileName(name).replace(/\.json$/, '')

  async function render() {
    const v = view.current
    if (!v || (photoId && !photo)) return onMessage('The photo is not in this browser.', true)
    const box = v.extent
    const size = exportSize(photo, box)
    // shortcut: iOS limits a canvas to about 16.7 MP (unverified on a device); a larger photo fails
    // there; upgrade by scaling the export down past that size
    // sizes as on a 1000 px wide screen, whatever the window and the zoom
    const k = box.w / 1000
    flushSync(() => setJob({ box, k }))
    try {
      const canvas = await renderCanvas({ photo, box, size, turn, k })
      const type = photo ? 'image/jpeg' : 'image/png'
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.92))
      if (!blob) throw new Error('the browser made no image')
      download(blob, `${stem}-rendered.${extension(type)}`)
      onMessage(`Exported ${size.w} x ${size.h} px.`)
    } catch (e) {
      onMessage(`Not exported: ${errorText(e)}`, true)
    } finally {
      setJob(undefined)
    }
  }

  async function original() {
    const blob = photoId && (await storedPhoto(photoId).catch(() => undefined))
    if (!blob) return onMessage('The photo is not in this browser.', true)
    download(blob, `${stem}-photo.${extension(blob.type)}`)
  }

  return (
    <>
      <Menu position="bottom-end" withInitialFocusPlaceholder={false}>
        <Menu.Target>
          {text ? (
            <Button variant="default" leftSection={<Export aria-hidden="true" />}>
              Export
            </Button>
          ) : (
            <ActionIcon variant="default" aria-label="Export" title="Export images and print">
              <span className="icon-slot" aria-hidden="true">
                <Export />
              </span>
            </ActionIcon>
          )}
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item disabled={!photo} onClick={original} title="The photo file as it was loaded">
            Original photo
          </Menu.Item>
          <Menu.Item
            onClick={render}
            title="Photo, overlays, notes and statistics box at the photo's pixel size"
          >
            Rendered image
          </Menu.Item>
          {onPrint && (
            <>
              <Menu.Divider />
              <Menu.Item
                onClick={onPrint}
                title="What Fit shows at a stated scale with a ruler, and the statistics"
              >
                Print sheet
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      {job &&
        createPortal(
          <div
            className="target-offscreen"
            style={{ width: 1000, height: (1000 * job.box.h) / job.box.w }}
          >
            {still(job.box, job.k)}
          </div>,
          document.body,
        )}
    </>
  )
}
