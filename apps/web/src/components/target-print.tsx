'use client'

import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import type { Ref } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { printDay } from '../lib/dates.ts'
import { readouts } from '../lib/group-readouts.ts'
import { type Frame, viewToTarget } from '../lib/target-editor.ts'
import { groupStatisticsOf } from '../lib/target-groups.ts'
import { printArea, printLayout, scaleText, type ViewBox } from '../lib/target-view.ts'
import { formatQuantity, type UnitSystem } from '../lib/units.ts'
import { printAlone } from './print.ts'
import type { StillCanvas } from './target-export.tsx'

/** The load of the workbench as the print sheet names it; `velocities` per ladder step, simulated. */
export type LoadSummary = { load: string; velocities: (string | undefined)[] }

const pxPerMm = 96 / 25.4

/** Target m per view unit at the centre of `box`: exact for line and ring references. */
function mPerUnit(frame: Frame, box: ViewBox) {
  const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
  const o = viewToTarget(frame, c)
  const along = (dx: number, dy: number) => {
    const p = viewToTarget(frame, { x: c.x + dx, y: c.y + dy })
    return Math.hypot(p.x - o.x, p.y - o.y)
  }
  return (along(1, 0) + along(0, 1)) / 2
}

/**
 * The print sheet of a target: the fitted view `box`, centred and unframed, at a round scale
 * with a ruler that measures true printed at 100 %, the statistics of each group, and in the
 * workbench the load and the simulated velocity. Rendered into `body`, printed alone while
 * `<html data-print="target-sheet">` is set (`printTargetSheet`).
 */
export function TargetPrint({
  name,
  sheet,
  frame,
  box,
  photo,
  still,
  system,
  summary,
  photoRef,
  score,
}: {
  name: string
  sheet: TargetSheet
  frame?: Frame | undefined
  box: ViewBox
  photo?: { url: string; width: number; height: number } | undefined
  still: StillCanvas
  system: UnitSystem
  summary?: LoadSummary | undefined
  /** The printed photo, loaded before the print starts. */
  photoRef: Ref<HTMLImageElement>
  /** A group's ring score as one line, when it has a face. */
  score?: (g: ShotGroup) => string | undefined
}) {
  const { t, language } = useTranslation()
  const scaled = frame && (frame.calibration || !sheet.photo)
  const len = system.length
  const layout = scaled ? printLayout(box, mPerUnit(frame, box), len.toSi(1)) : undefined
  // without a scale the view fills the space
  const fit = Math.min(printArea.width / box.w, printArea.height / box.h)
  const w = layout?.width ?? box.w * fit
  const h = layout?.height ?? box.h * fit
  const s = w / box.w
  const k = box.w / (w * pxPerMm)
  const perspective = sheet.references.some((r) => r.kind === 'rectangle')
  const rows = sheet.groups.flatMap((g) => {
    const st = groupStatisticsOf(g)
    if (!st.shotCount) return []
    const shown = Object.fromEntries(readouts(st, g.distance).map((r) => [r.key, r]))
    const cell = (key: string) => {
      const r = shown[key]
      return r
        ? `${formatQuantity('length', system, r.value)} / ${formatQuantity('correction', system, r.angle)}`
        : t('n/a')
    }
    const v = summary?.velocities[summary.velocities.length === 1 ? 0 : (g.ladderStep ?? -1)]
    return [{ g, st, cell, v, ring: score?.(g) }]
  })
  const simulated = rows.some((r) => r.v)
  const scoredRows = rows.some((r) => r.ring)
  return createPortal(
    <div className="target-print">
      <h1>{name}</h1>
      <p className="print-date">
        {t('Printed {date}.', { date: printDay(new Date(), language) })}
        {summary && ` ${t('Load: {load}.', { load: summary.load })}`}
      </p>
      <div className="print-image" style={{ width: `${w}mm`, height: `${h}mm` }}>
        {photo && (
          // biome-ignore lint/performance/noImgElement: the photo's blob URL at a size in mm, for print only
          <img
            ref={photoRef}
            src={photo.url}
            alt=""
            style={{
              left: `${-box.x * s}mm`,
              top: `${-box.y * s}mm`,
              width: `${photo.width * s}mm`,
              height: `${photo.height * s}mm`,
              ...(sheet.photoRotation && {
                transform: `rotate(${-sheet.photoRotation}rad)`,
              }),
            }}
          />
        )}
        {still(box, k)}
      </div>
      {layout ? (
        <>
          <p className="print-ruler">
            <span className="print-ruler-bar" style={{ width: `${layout.ruler.mm}mm` }} />{' '}
            {plainNumber(layout.ruler.length)} {len.symbol}
          </p>
          <p className="print-scale">
            {t('Scale {scale}: print at 100 %, not fitted to the page.', {
              scale: scaleText(layout.scale),
            })}
            {perspective &&
              ` ${t('The photo keeps its perspective: the scale holds at the center of the view.')}`}
          </p>
        </>
      ) : (
        <p className="print-scale">{t('No scale: the photo has no reference.')}</p>
      )}
      {rows.length > 0 && (
        <table className="sheet-table print-stats">
          <caption>
            {t('Statistics ({length} / {angle})', {
              length: len.symbol,
              angle: system.correction.symbol,
            })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Group')}</th>
              <th scope="col">{t('Shots')}</th>
              <th scope="col">{t('Distance')}</th>
              <th scope="col">{t('ES')}</th>
              <th scope="col">{t('Mean radius')}</th>
              <th scope="col">{t('CEP')}</th>
              {scoredRows && <th scope="col">{t('Score (decimal), inner tens')}</th>}
              {simulated && <th scope="col">{t('Velocity, simulated')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, st, cell, v, ring }) => (
              <tr key={g.id}>
                <th scope="row">{g.name}</th>
                <td>
                  {st.excludedCount
                    ? t('{shotCount} + {excluded} excl.', {
                        shotCount: st.shotCount,
                        excluded: st.excludedCount,
                      })
                    : st.shotCount}
                </td>
                <td>
                  {formatQuantity('range', system, g.distance)} {system.range.symbol}
                </td>
                <td>{cell('extremeSpread')}</td>
                <td>{cell('meanRadius')}</td>
                <td>{cell('cepElliptical')}</td>
                {scoredRows && <td>{ring ?? t('n/a')}</td>}
                {simulated && <td>{v ?? t('n/a')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>,
    document.body,
  )
}

/** Prints the sheet alone: the attribute switches the print rules until the dialog closes. */
export const printTargetSheet = (done: () => void) => printAlone('target-sheet', done)
