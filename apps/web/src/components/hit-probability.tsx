'use client'

import { NativeSelect } from '@mantine/core'
import {
  type HitResult,
  hitProbability,
  pointDispersion,
  type TrajectoryPoint,
} from '@open-reloading/core'
import type { TargetFace } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { errorText } from '../lib/error-text.ts'
import { type FaceSummary, fetchFace, fetchFaceSummaries } from '../lib/face-records.ts'
import { type FieldSpec, type Fields, fieldError, initialFields } from '../lib/field-spec.ts'
import { faceZones, impactSensitivity } from '../lib/hit-probability.ts'
import { nth } from '../lib/nth.ts'
import { formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { PanelTable } from './scroll-region.tsx'
import { useFieldUnits } from './units-settings.tsx'

const fieldSpecs = (hole: number) =>
  [
    {
      key: 'group',
      label: msg('Group standard deviation per axis'),
      help: msg('Of the group you measured, at the reference distance.'),
      quantity: 'length',
      required: true,
      positive: true,
      initial: 0.012,
    },
    {
      key: 'reference',
      label: msg('Reference distance'),
      quantity: 'range',
      required: true,
      positive: true,
      initial: 100,
    },
    {
      key: 'windSd',
      label: msg('Wind speed uncertainty'),
      quantity: 'windSpeed',
      required: true,
      min: 0,
      initial: 1,
    },
    {
      key: 'windDirectionSd',
      label: msg('Wind direction uncertainty'),
      quantity: 'angle',
      required: true,
      min: 0,
      initial: Math.PI / 36,
    },
    {
      key: 'rangeSd',
      label: msg('Range uncertainty'),
      quantity: 'range',
      required: true,
      min: 0,
      initial: 5,
    },
    {
      key: 'hole',
      label: msg('Scored hole diameter'),
      help: msg('The bullet diameter by default: a shot scores a ring its edge touches.'),
      quantity: 'length',
      required: true,
      min: 0,
      initial: hole,
    },
  ] as const satisfies readonly FieldSpec[]

type Load =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; face: TargetFace }
  | { status: 'error'; message: string }

/**
 * The probability of a hit and the expected score on a target face at one of the trajectory's
 * table ranges, from the group's dispersion with the wind and range uncertainty added
 * (`apps/docs/docs/models/hit-probability.md`).
 */
export function HitProbability({
  points,
  windPerUnit,
  wind,
  bulletDiameter,
  system,
}: {
  points: readonly TrajectoryPoint[]
  /** Windage hold per 1 m/s of crosswind at each point, rad. */
  windPerUnit: readonly number[]
  /** The wind of the shot: speed m/s and the direction it comes from, rad. */
  wind: { speed: number; from: number }
  bulletDiameter: number
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const specs = useMemo(() => fieldSpecs(bulletDiameter), [bulletDiameter])
  const [fields, setFields] = useState<Fields>(() => initialFields(specs, system))
  useFieldUnits(specs, system, (update) => setFields((f) => update(f)))
  const [faces, setFaces] = useState<FaceSummary[]>([])
  const [faceId, setFaceId] = useState('')
  const [load, setLoad] = useState<Load>({ status: 'idle' })
  const candidates = points.map((p, i) => ({ p, i })).filter(({ p }) => p.range > 0)
  const [at, setAt] = useState(() => {
    const best = candidates.reduce<number | undefined>(
      (b, { p, i }) =>
        b === undefined || Math.abs(p.range - 100) < Math.abs(nth(points, b).range - 100) ? i : b,
      undefined,
    )
    return best ?? 0
  })
  useEffect(() => {
    fetchFaceSummaries().then(setFaces, () => {})
  }, [])
  useEffect(() => {
    if (!faceId) return setLoad({ status: 'idle' })
    let current = true
    setLoad({ status: 'loading' })
    fetchFace(faceId).then(
      (face) => current && setLoad({ status: 'ok', face }),
      (e) => current && setLoad({ status: 'error', message: errorText(e) }),
    )
    return () => {
      current = false
    }
  }, [faceId])

  const errors = Object.fromEntries(
    specs.map((s) => [s.key, fieldError(s, fields[s.key], system, t)]),
  )
  const v = (key: string) => fields[key]?.si
  const point = points[at]
  const sensitivity = point && impactSensitivity(points, windPerUnit, at)
  const ready = specs.every((s) => !errors[s.key] && v(s.key) !== undefined)
  let outcome:
    | { result: HitResult; sx: number; sy: number; wind: number; range: number }
    | undefined
  let failure = ''
  if (ready && sensitivity && point && load.status === 'ok')
    try {
      const d = pointDispersion({
        group: { horizontal: v('group') as number, vertical: v('group') as number },
        referenceDistance: v('reference') as number,
        distance: point.range,
        wind: {
          ...wind,
          speedSd: v('windSd') as number,
          directionSd: v('windDirectionSd') as number,
          perCrosswind: sensitivity.perCrosswind,
        },
        range: { sd: v('rangeSd') as number, verticalPerMetre: sensitivity.verticalPerMetre },
      })
      outcome = {
        result: hitProbability(faceZones(load.face, v('hole') as number), d),
        sx: d.horizontal,
        sy: d.vertical,
        wind: d.parts.wind,
        range: d.parts.range,
      }
    } catch (e) {
      failure = errorText(e)
    }
  const length = (m: number) => `${formatQuantity('length', system, m)} ${system.length.symbol}`
  const percent = (p: number) => `${formatNumber(100 * p, p < 0.1 ? 2 : 1)} %`
  if (candidates.length < 2) return null
  return (
    <section className="hit-probability" aria-labelledby="hit-probability-title">
      <h3 id="hit-probability-title">{t('Hit probability')}</h3>
      <p className="note">
        {t(
          'A dispersion model, not a prediction of a score. It assumes your group is typical of the shots to come, dispersion grows linearly with distance, the zero is right, and wind and range errors are independent and small enough for a first-order estimate. Hold and aim errors beyond the group are not included.',
        )}
      </p>
      <div className="hit-probability-fields">
        <NativeSelect
          label={t('Target')}
          value={faceId}
          data={[
            { value: '', label: t('Choose a target') },
            ...faces.map((f) => ({ value: f.id, label: `${f.name} (${f.organization})` })),
          ]}
          onChange={(e) => setFaceId(e.currentTarget.value)}
        />
        <NativeSelect
          label={t('Distance ({unit})', { unit: system.range.symbol })}
          value={String(at)}
          data={candidates.map(({ p, i }) => ({
            value: String(i),
            label: formatQuantity('range', system, p.range),
          }))}
          onChange={(e) => setAt(Number(e.currentTarget.value))}
        />
        {specs.map((spec) => (
          <NumberField
            key={spec.key}
            spec={spec}
            system={system}
            value={fields[spec.key]}
            onChange={(value) => setFields((f) => ({ ...f, [spec.key]: value }))}
            error={errors[spec.key]}
          />
        ))}
      </div>
      {load.status === 'error' && (
        <p role="alert">
          {t('The target could not be read: {reason}', {
            reason: translateMessage(load.message, t),
          })}
        </p>
      )}
      {failure && <p role="alert">{translateMessage(failure, t)}</p>}
      {outcome && point && (
        <>
          <dl className="readouts">
            <div>
              <dt>{t('Probability of a hit')}</dt>
              <dd>{percent(outcome.result.hit)}</dd>
            </div>
            <div>
              <dt>{t('Expected score')}</dt>
              <dd>{formatNumber(outcome.result.expectedScore, 2)}</dd>
            </div>
            <div>
              <dt>{t('Spread at the target, horizontal and vertical')}</dt>
              <dd>
                {length(outcome.sx)}, {length(outcome.sy)}
              </dd>
            </div>
          </dl>
          <PanelTable
            label={t('Probability per scoring zone')}
            caption={t('Probability that a shot scores each value (simulation)')}
            columns={[t('Value'), t('Probability')]}
            numeric
          >
            {outcome.result.zones.map((z) => (
              <tr key={z.value}>
                <td className="num">{z.value}</td>
                <td className="num">{percent(z.probability)}</td>
              </tr>
            ))}
          </PanelTable>
          <p className="note">
            {t(
              'Inputs: group {group} per axis at {reference}, target at {target}, wind {speed} from {from}. The wind adds {wind} and the range {range} to one standard deviation.',
              {
                group: length(v('group') as number),
                reference: withUnit('range', system, v('reference') as number),
                target: withUnit('range', system, point.range),
                speed: withUnit('windSpeed', system, wind.speed),
                from: withUnit('angle', system, wind.from),
                wind: length(outcome.wind),
                range: length(outcome.range),
              },
            )}
          </p>
        </>
      )}
      {!outcome && load.status !== 'error' && !failure && (
        <p className="note">
          {faceId ? t('Fill every field for a result.') : t('Choose a target for a result.')}
        </p>
      )}
    </section>
  )
}
