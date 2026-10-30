import type { ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import type { Translator } from '../i18n/translate.ts'
import { type BoxLabel, boxLabel, qrModules } from '../lib/box-label.ts'
import type { LoadRecord } from '../lib/load-tabs.ts'
import { recordNames } from '../lib/records-csv.ts'
import type { UnitSystem } from '../lib/units.ts'
import { storedRecords } from '../lib/user-store.ts'
import { printAlone } from './print.ts'

/** The QR code of `text` as one path of unit squares, sharp at any print size. */
function QrCode({ text }: { text: string }) {
  const modules = qrModules(text)
  const d = modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join('')
  return (
    <svg
      className="box-label-qr"
      viewBox={`0 0 ${modules.length} ${modules.length}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

/** One box label: the load's values beside the QR code, its text printed under the code. */
export function BoxLabelSheet({ label }: { label: BoxLabel }) {
  return (
    <section className="box-label">
      <h1>{label.title}</h1>
      <div className="box-label-values">
        <table className="sheet-table">
          <tbody>
            {label.rows.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="box-label-code">
        <QrCode text={label.payload} />
        <p>{label.payload}</p>
      </div>
    </section>
  )
}

/**
 * Prints the box label of a saved load alone (`<html data-print="box-label">`), the names of the
 * records it refers to read from this browser and the API first. `show` puts the label into a
 * portal of `body` and takes it out after printing: no `react-dom/client` root of its own, which
 * would split the page's bootstrap chunk.
 */
export async function printBoxLabel(
  r: LoadRecord,
  system: UnitSystem,
  t: Translator['t'],
  show: (label: ReactNode) => void,
) {
  const { records } = await storedRecords()
  // the other loads' references are not asked for
  const nameOf = await recordNames(records.filter((x) => x.kind !== 'load' || x.id === r.id))
  const label = boxLabel(r, nameOf, system, t)
  // in the document before the browser takes its print snapshot
  flushSync(() =>
    show(
      createPortal(
        <div className="box-labels">
          <BoxLabelSheet label={label} />
        </div>,
        document.body,
      ),
    ),
  )
  printAlone('box-label', () => show(undefined))
}
