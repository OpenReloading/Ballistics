'use client'

import { face, type LengthUnit, lengthText } from '@open-reloading/drawing'
import {
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
  bulletSymbols,
  recordProfile,
} from '@open-reloading/drawing/bullet'
import type { Bullet } from '@open-reloading/schema'
import { Ruler } from '@phosphor-icons/react/ssr'
import { useTranslation } from '../i18n/language.ts'
import { type Translator, translator } from '../i18n/translate.ts'
import { DrawingNotes } from './record-actions.tsx'
import { EmptyNote } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'

const nameOf = (symbol: string) => bulletSymbols.find((s) => s.symbol === symbol)?.name ?? symbol

/**
 * One description: every dimension by name, symbol and value in `unit`, then what is assumed. The
 * dimension names come from the drawing package and stay English.
 */
export function description(
  p: BulletProfile,
  unit: LengthUnit = 'mm',
  t: Translator['t'] = translator().t,
) {
  const { dimensions, radii } = p.annotation
  const values = [...dimensions, ...radii].map(
    (d) =>
      `${nameOf(d.symbol)} ${d.symbol} ${d.symbol === 'Rt/R' ? d.value : `${lengthText(d.value, unit)} ${unit}`}`,
  )
  const assumed = p.outline.segments.some((s) => s.approximate)
    ? ` ${t('Parts drawn dashed are assumed, not from the record.')}`
    : ''
  return `${t(
    'Technical drawing of the bullet, full section about the axis, base at the bottom: {values}.',
    { values: values.join(', ') },
  )}${assumed}`
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
  record: Bullet
  label: string
  unit?: LengthUnit | undefined
}) {
  const { t } = useTranslation()
  const p = recordProfile(record)
  if ('reason' in p)
    return (
      <EmptyNote
        icon={<Ruler size={24} aria-hidden="true" />}
        title={t('No drawing for this record.')}
        description={
          p.reason === 'The record has no length.'
            ? t('{reason} The drawing needs a diameter and a length.', { reason: p.reason })
            : p.reason
        }
      />
    )
  const id = `${record.id}-drawing`
  const title = t('Outline, {name}', { name: label })
  const model = bulletFigureModel(p, 'screen', bulletScreenEm(p, unit), 0, unit)
  const assumed = p.outline.segments.some((s) => s.approximate)
  const notes = [
    t(
      'Simplified drawing from the record; only values with a source are dimensioned. The table is the data.',
    ),
    ...(assumed
      ? [
          t(
            'Dashed in the flag color: parts the record does not give, drawn from an assumed shape.',
          ),
        ]
      : []),
    ...(p.undimensioned.length > 0
      ? [t('Not dimensioned: {parts}.', { parts: p.undimensioned.join(', ') })]
      : []),
    ...p.outline.notes,
  ]
  return (
    <figure className="drawing-figure">
      <TechnicalDrawing id={id} title={title} desc={description(p, unit, t)} model={model} linked />
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
          {notes.join(' ')} {t('Printed at 100 % scale, the drawing is life size (1:1).')}
        </span>
      </figcaption>
    </figure>
  )
}
