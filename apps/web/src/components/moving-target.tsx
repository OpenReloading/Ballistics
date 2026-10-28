'use client'

import type { TrajectoryPoint } from '@open-reloading/core'
import { useState } from 'react'
import { formatNumber } from '../i18n/number.ts'
import { type FieldSpec, type Fields, fieldError, initialFields } from '../lib/field-spec.ts'
import { movingTargetRows } from '../lib/moving-target.ts'
import { formatQuantity, type UnitSystem } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { PanelTable } from './scroll-region.tsx'
import { useFieldUnits } from './units-settings.tsx'

const specs = [
  { key: 'speed', label: 'Target speed', quantity: 'windSpeed', min: 0, required: true },
  {
    key: 'heading',
    label: 'Heading',
    help: 'Clockwise from directly away from the shooter: 90 crosses to the right, 270 to the left.',
    quantity: 'angle',
    required: true,
    initial: Math.PI / 2,
  },
  {
    key: 'length',
    label: 'Target length',
    help: 'Optional. Gives the lead in target lengths.',
    quantity: 'lineOfSightOffset',
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/**
 * The lead of a moving target at each range of the trajectory table, from the time of flight of
 * the trajectory (`apps/docs/docs/models/exterior-moving-target.md`).
 */
export function MovingTarget({
  points,
  system,
}: {
  points: readonly TrajectoryPoint[]
  system: UnitSystem
}) {
  const [fields, setFields] = useState<Fields>(() => initialFields(specs, system))
  useFieldUnits(specs, system, (update) => setFields((f) => update(f)))
  const errors = Object.fromEntries(specs.map((s) => [s.key, fieldError(s, fields[s.key], system)]))
  const { speed, heading, length } = {
    ...Object.fromEntries(specs.map((s) => [s.key, fields[s.key]?.si])),
  }
  const ready =
    !errors.speed &&
    !errors.heading &&
    !errors.length &&
    speed !== undefined &&
    heading !== undefined
  const rows = ready ? movingTargetRows(points, speed, heading, length) : []
  const lengths = rows.some((r) => r.lengths !== undefined)
  const u = (q: 'range' | 'lineOfSightOffset' | 'correction') => system[q].symbol
  return (
    <section className="moving-target" aria-labelledby="moving-target-title">
      <h3 id="moving-target-title">Moving target</h3>
      <div className="moving-target-fields">
        {specs.map((spec) => (
          <NumberField
            key={spec.key}
            spec={spec}
            system={system}
            value={fields[spec.key]}
            onChange={(v) => setFields((f) => ({ ...f, [spec.key]: v }))}
            error={errors[spec.key]}
          />
        ))}
      </div>
      {rows.length > 0 && (
        <PanelTable
          label="Moving target lead"
          caption="Lead for the target's motion during the time of flight to each range (simulation)"
          columns={[
            `Range (${u('range')})`,
            'Time (s)',
            `Lead (${u('lineOfSightOffset')})`,
            `Lead angle (${u('correction')})`,
            ...(lengths ? ['Target lengths'] : []),
          ]}
          numeric
        >
          {rows.map((r) => (
            <tr key={r.range}>
              <td className="num">{formatQuantity('range', system, r.range)}</td>
              <td className="num">{formatNumber(r.time, 3)}</td>
              <td className="num">{formatQuantity('lineOfSightOffset', system, r.lateral)}</td>
              <td className="num">{formatQuantity('correction', system, r.angle)}</td>
              {lengths && (
                <td className="num">{r.lengths === undefined ? '' : formatNumber(r.lengths, 1)}</td>
              )}
            </tr>
          ))}
        </PanelTable>
      )}
    </section>
  )
}
