'use client'

import type { ShotGroup, TargetSheet } from '@openreloading/schema'
import type { Ref } from 'react'
import { createPortal } from 'react-dom'
import { localDay } from '../lib/dates.ts'
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
  frame?: Frame
  box: ViewBox
  photo?: { url: string; width: number; height: number }
  still: StillCanvas
  system: UnitSystem
  summary?: LoadSummary
  /** The printed photo, loaded before the print starts. */
  photoRef: Ref<HTMLImageElement>
  /** A group's ring score as one line, when it has a face. */
  score?: (g: ShotGroup) => string | undefined
}) {
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
        : 'n/a'
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
        Printed {localDay(new Date())}.{summary && ` Load: ${summary.load}.`}
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
            {layout.ruler.length} {len.symbol}
          </p>
          <p className="print-scale">
            Scale {scaleText(layout.scale)}: print at 100 %, not fitted to the page.
            {perspective &&
              ' The photo keeps its perspective: the scale holds at the center of the view.'}
          </p>
        </>
      ) : (
        <p className="print-scale">No scale: the photo has no reference.</p>
      )}
      {rows.length > 0 && (
        <table className="sheet-table print-stats">
          <caption>
            Statistics ({len.symbol} / {system.correction.symbol})
          </caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Shots</th>
              <th scope="col">Distance</th>
              <th scope="col">ES</th>
              <th scope="col">Mean radius</th>
              <th scope="col">CEP</th>
              {scoredRows && <th scope="col">Score (decimal), inner tens</th>}
              {simulated && <th scope="col">Velocity, simulated</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ g, st, cell, v, ring }) => (
              <tr key={g.id}>
                <th scope="row">{g.name}</th>
                <td>
                  {st.shotCount}
                  {st.excludedCount ? ` + ${st.excludedCount} excl.` : ''}
                </td>
                <td>
                  {formatQuantity('range', system, g.distance)} {system.range.symbol}
                </td>
                <td>{cell('extremeSpread')}</td>
                <td>{cell('meanRadius')}</td>
                <td>{cell('cepElliptical')}</td>
                {scoredRows && <td>{ring ?? 'n/a'}</td>}
                {simulated && <td>{v ?? 'n/a'}</td>}
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
