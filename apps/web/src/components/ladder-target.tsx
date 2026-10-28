'use client'

import { Button } from '@mantine/core'
import { radPerMoa } from '@open-reloading/core'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { localDay } from '../lib/dates.ts'
import { type FieldSpec, type Fields, fieldError, initialFields } from '../lib/field-spec.ts'
import { cssMm, ladderMarks, markDiameterMm, maxMarkMm, rulerMm } from '../lib/ladder-target.ts'
import { formatQuantity, type UnitSystem } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { printAlone, usePortalBody } from './print.ts'
import { type MessageEntry, MessageSlot } from './states.tsx'
import { useFieldUnits } from './units-settings.tsx'

const specs = [
  {
    key: 'distance',
    label: msg('Shooting distance'),
    quantity: 'range',
    required: true,
    positive: true,
    initial: 100,
  },
  {
    key: 'size',
    label: msg('Mark size'),
    help: msg('Angular size of one aiming mark, printed at the distance.'),
    quantity: 'correction',
    required: true,
    positive: true,
    initial: radPerMoa,
  },
] as const satisfies readonly FieldSpec[]

/**
 * The print sheet of a ladder: one aiming mark per step with the step's own value, each of an
 * angular size at the shooting distance, and a check ruler. The controls take the distance and the
 * size; the sheet renders into `body` and prints alone while `<html data-print="ladder-target">`
 * is set.
 */
export function LadderTarget({
  labels,
  system,
}: {
  /** The value of each ladder step as the user's units show it, in step order. */
  labels: readonly string[]
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const body = usePortalBody()
  const [fields, setFields] = useState<Fields>(() => initialFields(specs, system))
  useFieldUnits(specs, system, (update) => setFields((f) => update(f)))
  const errors = Object.fromEntries(
    specs.map((s) => [s.key, fieldError(s, fields[s.key], system, t)]),
  )
  const distance = fields.distance?.si
  const size = fields.size?.si
  const valid = !errors.distance && !errors.size && distance !== undefined && size !== undefined
  const diameter = valid ? markDiameterMm(distance, size) : undefined
  const marks = valid ? ladderMarks(labels, distance, size) : []
  const tooBig = diameter !== undefined && diameter > maxMarkMm
  // the field errors and the size note share one slot of fixed height under the fields
  const messages: MessageEntry[] = [
    ...specs.flatMap((s) => {
      const error = errors[s.key]
      return error ? [{ severity: 'error' as const, text: error }] : []
    }),
    ...(tooBig
      ? [
          {
            severity: 'warning' as const,
            text: t(
              'A mark of {diameter} mm does not fit a sheet: choose a smaller size or distance.',
              { diameter: Math.round(diameter) },
            ),
          },
        ]
      : []),
  ]
  return (
    <section className="ladder-target-controls" aria-labelledby="ladder-target-title">
      <h3 id="ladder-target-title">{t('Ladder target')}</h3>
      <div className="ladder-target-fields">
        {specs.map((spec) => (
          <NumberField
            key={spec.key}
            spec={spec}
            system={system}
            value={fields[spec.key]}
            onChange={(v) => setFields((f) => ({ ...f, [spec.key]: v }))}
            error={errors[spec.key]}
            hiddenError
          />
        ))}
        <Button
          variant="default"
          disabled={marks.length === 0}
          onClick={() => printAlone('ladder-target')}
        >
          {t('Print ladder target')}
        </Button>
      </div>
      <MessageSlot label={t('Ladder target messages')} messages={messages} />
      {body &&
        marks.length > 0 &&
        distance !== undefined &&
        size !== undefined &&
        createPortal(
          <div className="ladder-target">
            <h1>{t('Ladder target')}</h1>
            <p className="sheet-date">{t('Printed {date}', { date: localDay(new Date()) })}</p>
            <p>
              {t('Distance {distance}, mark size {size} ({diameter} mm).', {
                distance: `${formatQuantity('range', system, distance)} ${system.range.symbol}`,
                size: `${formatQuantity('correction', system, size)} ${system.correction.symbol}`,
                diameter: plainNumber(Math.round((diameter ?? 0) * 10) / 10),
              })}
            </p>
            <div className="ladder-marks">
              {marks.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: marks keep the step order and labels can repeat
                <figure key={i}>
                  <svg
                    width={cssMm(m.diameter)}
                    height={cssMm(m.diameter)}
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="50" r="50" fill="#000" />
                  </svg>
                  <figcaption>{m.label}</figcaption>
                </figure>
              ))}
            </div>
            <div className="ladder-ruler" style={{ width: cssMm(rulerMm) }}>
              <span>{rulerMm} mm</span>
            </div>
            <p>{t('Print at 100 % scale: the ruler measures {length} mm.', { length: rulerMm })}</p>
          </div>,
          body,
        )}
    </section>
  )
}
