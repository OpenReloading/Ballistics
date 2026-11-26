'use client'

import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import type { Bullet } from '@rangefoundry/schema'
import { face, type LengthUnit, lengthText } from '@rangefoundry/svg-drawings'
import {
  type BulletProfile,
  bulletFigureModel,
  bulletScreenEm,
  bulletSymbols,
  recordProfile,
} from '@rangefoundry/svg-drawings/bullet'
import { Ruler } from 'lucide-react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/bullet-drawing.json' with { type: 'json' }
import { DrawingNotes } from './record-actions.tsx'
import { EmptyNote } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'

loadEnglish(englishMessages)

const nameOf = (symbol: string) => bulletSymbols.find((s) => s.symbol === symbol)?.name ?? symbol

/** The dimension names come from the drawing package and stay English. */
export function description(p: BulletProfile, unit: LengthUnit, i18n: I18n) {
  const { dimensions, radii } = p.annotation
  const values = [...dimensions, ...radii].map(
    (d) =>
      `${nameOf(d.symbol)} ${d.symbol} ${d.symbol === 'Rt/R' ? d.value : `${lengthText(d.value, unit)} ${unit}`}`,
  )
  const assumed = p.outline.segments.some((s) => s.approximate)
    ? ` ${i18n._({ id: 'bulletDrawing.assumed', message: 'Parts drawn dashed are assumed, not from the record.' })}`
    : ''
  return `${i18n._({
    id: 'bulletDrawing.description',
    message:
      'Technical drawing of the bullet, full section about the axis, base at the bottom: {values}.',
    values: { values: values.join(', ') },
  })}${assumed}`
}

/** Server-rendered SVG and a life-size print drawing, as the cartridge drawings; length texts in `unit`, a stated reason where the record cannot be drawn. */
export function BulletDrawing({
  record,
  label,
  unit = 'mm',
}: {
  record: Bullet
  label: string
  unit?: LengthUnit | undefined
}) {
  const { i18n } = useLingui()
  const p = recordProfile(record)
  if ('reason' in p)
    return (
      <EmptyNote
        icon={<Ruler size={24} aria-hidden="true" />}
        title={i18n._({ id: 'bulletDrawing.none', message: 'No drawing for this record.' })}
        description={
          p.reason === 'The record has no length.'
            ? i18n._({
                id: 'bulletDrawing.noLength',
                message: '{reason} The drawing needs a diameter and a length.',
                values: { reason: p.reason },
              })
            : p.reason
        }
      />
    )
  const id = `${record.id}-drawing`
  const title = i18n._({
    id: 'bulletDrawing.outline',
    message: 'Outline, {name}',
    values: { name: label },
  })
  const model = bulletFigureModel(p, 'screen', bulletScreenEm(p, unit), 0, unit)
  const assumed = p.outline.segments.some((s) => s.approximate)
  const notes = [
    i18n._({
      id: 'bulletDrawing.simplified',
      message:
        'Simplified drawing from the record; only values with a source are dimensioned. The table is the data.',
    }),
    ...(assumed
      ? [
          i18n._({
            id: 'bulletDrawing.dashed',
            message:
              'Dashed in the flag color: parts the record does not give, drawn from an assumed shape.',
          }),
        ]
      : []),
    ...(p.undimensioned.length > 0
      ? [
          i18n._({
            id: 'bulletDrawing.notDimensioned',
            message: 'Not dimensioned: {parts}.',
            values: { parts: p.undimensioned.join(', ') },
          }),
        ]
      : []),
    ...p.outline.notes,
  ]
  return (
    <figure className="drawing-figure">
      <TechnicalDrawing
        id={id}
        title={title}
        desc={description(p, unit, i18n)}
        model={model}
        linked
      />
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
          {notes.join(' ')}{' '}
          {i18n._({
            id: 'bulletDrawing.lifeSize',
            message: 'Printed at 100 % scale, the drawing is life size (1:1).',
          })}
        </span>
      </figcaption>
    </figure>
  )
}
