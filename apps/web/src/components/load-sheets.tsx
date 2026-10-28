'use client'

import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { printDay } from '../lib/dates.ts'
import { printAlone, usePortalBody } from './print.ts'

/** One charge of the load as the sheets show it: display texts, simulated values. */
type SheetStep = {
  n: number
  /** The step relative to the main charge, 0. */
  label: string
  charge: string
  pressure?: string | undefined
  ofMax?: string | undefined
  velocity?: string | undefined
  energy?: string | undefined
  flag?: string | undefined
}

/**
 * The load to take to the bench: an overview page with the components and
 * every charge, then one page per charge with blanks to fill while loading and at the range. Rendered
 * into `body` and printed alone while `<html data-print="sheets">` is set (`printSheets`).
 */
export function LoadSheets({
  title,
  components,
  note,
  by,
  steps,
}: {
  title: string
  /** Printed after the date: that inputs changed since the run, values that are approximate. */
  note?: string | undefined
  /** Label and value rows: cartridge, bullet, powder, seating, firearm. */
  components: [string, string][]
  /** The length the bullet is seated by when the steps vary it, as the sheet names it; none for a charge ladder. */
  by?: string | undefined
  steps: SheetStep[]
}) {
  const { t, language } = useTranslation()
  // the portal target exists after mounting only (server render has no document)
  const body = usePortalBody()
  if (!body) return null
  const simulated = steps.some((s) => s.pressure)
  // the components in two columns: half the height of one long table
  const half = Math.ceil(components.length / 2)
  const table = (
    <div className="sheet-components">
      {[components.slice(0, half), components.slice(half)].map((part) => (
        <table key={part[0]?.[0] ?? 'none'} className="sheet-table">
          <tbody>
            {part.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
  const lines = (n: number) => Array.from({ length: n }, (_, i) => i)
  return createPortal(
    <div className="load-sheets">
      <section className="load-sheet">
        <h1>{title}</h1>
        <p className="sheet-date">
          {t('Printed {date}.', { date: printDay(new Date(), language) })}
          {note && ` ${note}`}
        </p>
        {table}
        <h2>{by === undefined ? t('Charges') : t('{length} steps', { length: by })}</h2>
        <table className="sheet-table sheet-steps">
          <thead>
            <tr>
              <th scope="col">{t('Step')}</th>
              <th scope="col">{by ?? t('Charge')}</th>
              {simulated && (
                <>
                  <th scope="col">{t('Peak pressure, simulated (range)')}</th>
                  <th scope="col">{t('Of max.')}</th>
                  <th scope="col">{t('Velocity, simulated')}</th>
                  <th scope="col">{t('Flag')}</th>
                </>
              )}
              {/* blanks: the one page holds the bench and the range */}
              <th scope="col">{t('Rounds')}</th>
              <th scope="col">{t('Loaded')}</th>
              <th scope="col">{t('Velocity, measured')}</th>
              <th scope="col">{t('SD / ES')}</th>
              <th scope="col">{t('Group')}</th>
              <th scope="col">{t('Pressure signs, notes')}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.n}>
                <td>
                  {s.label}
                  {s.label === '0' && ` ${t('main')}`}
                </td>
                <td className="num">{s.charge}</td>
                {simulated && (
                  <>
                    <td className="num">{s.pressure}</td>
                    <td className="num">{s.ofMax}</td>
                    <td className="num">{s.velocity}</td>
                    <td>{s.flag}</td>
                  </>
                )}
                <td className="blank" />
                <td className="blank">
                  <span className="box" />
                </td>
                <td className="blank" />
                <td className="blank" />
                <td className="blank" />
                <td className="blank wide-blank" />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {steps.map((s) => (
        <section key={s.n} className="load-sheet step">
          <h1>
            {s.label === '0'
              ? t('Step {step}, main: {value}', { step: s.label, value: s.charge })
              : t('Step {step}: {value}', { step: s.label, value: s.charge })}
          </h1>
          <p className="sheet-sub">{title}</p>
          {table}
          {s.pressure && (
            <p className="sheet-sim">
              {t('Simulated peak {pressure}', { pressure: s.pressure })}
              {s.ofMax && ` ${t('({share} of maximum)', { share: s.ofMax })}`}
              {`, ${t('velocity {velocity}', { velocity: s.velocity ?? '' })}`}
              {s.flag && `, ${s.flag}`}.
            </p>
          )}
          <h2>{t('At the bench')}</h2>
          <table className="sheet-table">
            <tbody>
              {[
                t('Date'),
                t('Rounds loaded'),
                t('Charge weights thrown'),
                t('COAL measured'),
                t('Case lot, primer lot'),
              ].map((k) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="blank" />
                </tr>
              ))}
            </tbody>
          </table>
          <h2>{t('At the range')}</h2>
          <table className="sheet-table">
            <tbody>
              {[t('Date, temperature'), t('Group size'), t('Point of impact')].map((k) => (
                <tr key={k}>
                  <th scope="row">{k}</th>
                  <td className="blank" />
                </tr>
              ))}
              <tr>
                <th scope="row">{t('Pressure signs')}</th>
                <td>
                  {[
                    t('flattened or cratered primer'),
                    t('ejector mark'),
                    t('hard bolt lift'),
                    t('case head expansion'),
                  ].map((k) => (
                    <span key={k} className="sheet-check">
                      <span className="box" /> {k}
                    </span>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="sheet-table sheet-chrono">
            <thead>
              <tr>
                <th scope="col">{t('Shot')}</th>
                {lines(10).map((i) => (
                  <th key={i} scope="col">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('Velocity')}</th>
                {lines(10).map((i) => (
                  <td key={i} className="blank" />
                ))}
              </tr>
            </tbody>
          </table>
          <h2>{t('Notes')}</h2>
          {lines(5).map((i) => (
            <div key={i} className="sheet-line" />
          ))}
        </section>
      ))}
    </div>,
    body,
  )
}

/**
 * Prints the sheets alone, the overview only or with a page per charge (`steps`): the attribute
 * switches the print rules until the dialog closes.
 */
export const printSheets = (steps: boolean) => printAlone(steps ? 'sheets-steps' : 'sheets')
