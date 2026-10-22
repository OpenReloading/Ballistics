import { face, type LengthUnit, lengthText } from '@openreloading/drawing'
import {
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
  bulletSymbols,
  recordProfile,
} from '@openreloading/drawing/bullet'
import { Ruler } from '@phosphor-icons/react/ssr'
import type { BulletRecord } from '../lib/api-types.ts'
import { DrawingNotes } from './record-actions.tsx'
import { EmptyNote } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'

const nameOf = (symbol: string) => bulletSymbols.find((s) => s.symbol === symbol)?.name ?? symbol

/** One description: every dimension by name, symbol and value in `unit`, then what is assumed. */
export function description(p: BulletProfile, unit: LengthUnit = 'mm') {
  const { dimensions, radii } = p.annotation
  const values = [...dimensions, ...radii].map(
    (d) =>
      `${nameOf(d.symbol)} ${d.symbol} ${d.symbol === 'Rt/R' ? d.value : `${lengthText(d.value, unit)} ${unit}`}`,
  )
  const assumed = p.outline.segments.some((s) => s.approximate)
    ? ' Parts drawn dashed are assumed, not from the record.'
    : ''
  return `Technical drawing of the bullet, full section about the axis, base at the bottom: ${values.join(', ')}.${assumed}`
}

/**
 * The technical drawing of a bullet record in the face of the cartridge drawings: server-rendered
 * SVG, a life-size print drawing; a stated reason where the record cannot be drawn. Length texts
 * in `unit`; `label` names the bullet (manufacturer and name).
 */
export function BulletDrawing({
  record,
  label,
  unit = 'mm',
}: {
  record: BulletRecord
  label: string
  unit?: LengthUnit
}) {
  const p = recordProfile(record)
  if ('reason' in p)
    return (
      <EmptyNote
        icon={<Ruler size={24} aria-hidden="true" />}
        title="No drawing for this record."
        description={`${p.reason}${p.reason === 'The record has no length.' ? ' The drawing needs a diameter and a length.' : ''}`}
      />
    )
  const id = `${record.id}-drawing`
  const title = `Outline, ${label}`
  const model = bulletFigureModel(p, 'screen', bulletScreenEm(p, unit), 0, unit)
  const symbols = [...p.annotation.dimensions, ...p.annotation.radii].map(
    (d) => `${d.symbol} ${nameOf(d.symbol)}`,
  )
  const assumed = p.outline.segments.some((s) => s.approximate)
  const notes = [
    'Simplified drawing from the values as stored in the record; only values with a source are dimensioned. The table remains the data.',
    ...(assumed
      ? ['Dashed in the flag color: parts the record does not give, drawn from an assumed shape.']
      : []),
    `Symbols: ${symbols.join(', ')}.`,
    ...(p.undimensioned.length > 0 ? [`Not dimensioned: ${p.undimensioned.join(', ')}.`] : []),
    ...p.outline.notes,
  ]
  return (
    <figure className="drawing-figure">
      <TechnicalDrawing id={id} title={title} desc={description(p, unit)} model={model} linked />
      {/* the print drawing shares the screen drawing's description */}
      <TechnicalDrawing
        id={`${id}-print`}
        title={title}
        describedBy={`${id}-desc`}
        model={bulletFigureModel(p, 'print', face.printEm, 0, unit)}
      />
      {/* the notes behind a button on screen (the figure keeps its height), in full on paper */}
      <figcaption>
        <DrawingNotes notes={notes} />
        <span className="print-only">
          {notes.join(' ')} Printed at 100 % scale, the drawing is life size (1:1).
        </span>
      </figcaption>
    </figure>
  )
}
