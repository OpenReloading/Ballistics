'use client'

import { ActionIcon, Button, Menu } from '@mantine/core'
import type { ShotGroup } from '@open-reloading/schema'
import { Export } from '@phosphor-icons/react'
import { type ReactNode, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
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
  const translator = useTranslation()
  const { t } = translator
  const lines = groups.flatMap((g): { text: string; colour?: string }[] => {
    const s = groupStatisticsOf(g)
    if (!s.shotCount) return []
    return [
      { text: g.name, colour: g.colour },
      ...statLines(s, readouts(s, g.distance), system, translator).map((text) => ({ text })),
      ...(score?.(g) ? [{ text: t('Score {score}', { score: score(g) ?? '' }) }] : []),
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

export const extension = (type: string) =>
  type === 'image/jpeg' ? 'jpg' : (type.split('/')[1]?.replace(/\W[\s\S]*/, '') ?? 'img')

/**
 * What one rendered image is made of, taken together at the click: a sheet switched while the
 * renderer loads changes neither the drawing nor the box, photo or file name.
 */
export function renderJob(
  still: StillCanvas,
  box: ViewBox,
  photo: { url: string; width: number; height: number } | undefined,
  turn: number,
  stem: string,
) {
  // shortcut: iOS limits a canvas to about 16.7 MP (unverified on a device); a larger photo fails
  // there; upgrade by scaling the export down past that size
  // sizes as on a 1000 px wide screen, whatever the window and the zoom
  const k = box.w / 1000
  const type = photo ? 'image/jpeg' : 'image/png'
  return {
    box,
    k,
    size: exportSize(photo, box),
    photo,
    turn,
    type,
    file: `${stem}-rendered.${extension(type)}`,
    svg: still(box, k),
  }
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
  const { t } = useTranslation()
  const [job, setJob] = useState<ReturnType<typeof renderJob>>()
  const stem = recordFileName(name).replace(/\.json$/, '')

  async function render() {
    const v = view.current
    if (!v || (photoId && !photo)) return onMessage(t('The photo is not in this browser.'), true)
    const frozen = renderJob(still, v.extent, photo, turn, stem)
    flushSync(() => setJob(frozen))
    try {
      const { renderCanvas } = await import('../lib/target-render.ts')
      const canvas = await renderCanvas({ ...frozen, t })
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, frozen.type, 0.92))
      if (!blob) throw new Error(t('the browser made no image'))
      download(blob, frozen.file)
      onMessage(t('Exported {w} x {h} px.', { w: frozen.size.w, h: frozen.size.h }))
    } catch (e) {
      onMessage(t('Not exported: {reason}', { reason: errorText(e) }), true)
    } finally {
      setJob(undefined)
    }
  }

  async function original() {
    const blob = photoId && (await storedPhoto(photoId).catch(() => undefined))
    if (!blob) return onMessage(t('The photo is not in this browser.'), true)
    download(blob, `${stem}-photo.${extension(blob.type)}`)
  }

  return (
    <>
      <Menu position="bottom-end" withInitialFocusPlaceholder={false}>
        <Menu.Target>
          {text ? (
            <Button variant="default" leftSection={<Export aria-hidden="true" />}>
              {t('Export')}
            </Button>
          ) : (
            <ActionIcon
              variant="default"
              aria-label={t('Export')}
              title={t('Export images and print')}
            >
              <span className="icon-slot" aria-hidden="true">
                <Export />
              </span>
            </ActionIcon>
          )}
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            disabled={!photo}
            onClick={original}
            title={t('The photo file as it was loaded')}
          >
            {t('Original photo')}
          </Menu.Item>
          <Menu.Item
            onClick={render}
            title={t("Photo, overlays, notes and statistics box at the photo's pixel size")}
          >
            {t('Rendered image')}
          </Menu.Item>
          {onPrint && (
            <>
              <Menu.Divider />
              <Menu.Item
                onClick={onPrint}
                title={t('What Fit shows at a stated scale with a ruler, and the statistics')}
              >
                {t('Print sheet')}
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
            {job.svg}
          </div>,
          document.body,
        )}
    </>
  )
}
