'use client'

import type { TrajectoryPoint } from '@open-reloading/core'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { printDay } from '../lib/dates.ts'
import { clickText } from '../lib/firearm.ts'
import { rangeCardColumns, rangeCardFacts, rangeCardRows } from '../lib/range-card.ts'
import type { UnitSystem } from '../lib/units.ts'
import { printAlone, usePortalBody } from './print.ts'

/** The paper sizes of the printed card. */
export const paperSizes = ['a6', 'a5', 'a4'] as const
export type PaperSize = (typeof paperSizes)[number]

/**
 * The range card of a trajectory result: rendered into `body`, never on
 * screen, printed alone while `<html data-print="range-card">` is set (`printRangeCard`). With the
 * result's `click` the holds are also given in clicks.
 */
export function RangeCard({
  result,
  system,
  paper,
}: {
  result: {
    bullet: string
    zeroRange: number
    si: Record<string, number | undefined>
    manual: boolean
    /** Where the drag factor of the result comes from. */
    dragSource?: string
    tablePoints: TrajectoryPoint[]
    windPerUnit: { mps: number[]; mph: number[] }
    click?: { value: number; unit?: 'MOA' | 'mrad' | undefined }
  }
  system: UnitSystem
  paper: PaperSize
}) {
  const { t, language } = useTranslation()
  // the portal target exists after mounting only (server render has no document)
  const body = usePortalBody()
  if (!body) return null
  const extras = { click: result.click?.value, wind: result.windPerUnit }
  const columns = rangeCardColumns(system, extras, t)
  const facts = rangeCardFacts(
    result.si,
    result.zeroRange,
    system,
    result.manual,
    result.dragSource,
    t,
  )
  if (result.click)
    facts.push([
      t('Click value'),
      clickText({ clickValue: result.click.value, clickUnit: result.click.unit }, system) ?? '',
    ])
  return createPortal(
    <div className="range-card" data-paper={paper}>
      <h1>{t('Range card: {name}', { name: result.bullet })}</h1>
      <p className="sheet-date">{t('Printed {date}', { date: printDay(new Date(), language) })}</p>
      <dl className="range-card-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <table className="sheet-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={i < columns.length - 1 ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rangeCardRows(result.tablePoints, system, extras).map((cells) => (
            <tr key={cells[0]}>
              {cells.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the columns are fixed
                <td key={i} className="num">
                  {c}
                </td>
              ))}
              <td className="blank notes" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    body,
  )
}

/** Prints the range card alone: the attribute switches the print rules until the dialog closes. */
export const printRangeCard = () => printAlone('range-card')
