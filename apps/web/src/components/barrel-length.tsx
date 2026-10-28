'use client'

import { Button, SegmentedControl } from '@mantine/core'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import type { FieldSpec } from '../lib/field-spec.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity, msText, type UnitSystem } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { PanelTable } from './scroll-region.tsx'
import type { BarrelStudy, RangeKey } from './use-barrel-study.ts'

const BarrelChart = dynamic(() => import('./barrel-chart.tsx').then((m) => m.BarrelChart), {
  ssr: false,
  loading: () => <div className="chart barrel-chart" />,
})

const rangeSpecs: readonly (FieldSpec & { key: RangeKey })[] = [
  { key: 'from', label: msg('From'), quantity: 'barrelLength', min: 0 },
  { key: 'to', label: msg('To'), quantity: 'barrelLength', min: 0 },
  { key: 'step', label: msg('Step'), quantity: 'barrelLength', min: 0 },
]

const columns = [
  msg('Barrel length'),
  msg('Muzzle velocity'),
  msg('Muzzle energy'),
  msg('Muzzle pressure'),
  msg('Burnt at muzzle'),
  msg('Barrel time'),
  msg('Values from'),
]

/** Why a row has no values: the model's reason, or one of the study's own. */
function reasonText(reason: string, t: Translator['t']) {
  if (reason === 'the longer run ends before this length')
    return t('the longer run ends before this length')
  if (reason === 'invalid') return t('invalid')
  return translateMessage(reason, t)
}

/**
 * The rows of the shown step, one per barrel length, the workbench barrel marked. Values up to the
 * barrel are read from the run, longer ones from the longer run.
 */
export function BarrelTable({ study, system }: { study: BarrelStudy; system: UnitSystem }) {
  const { t } = useTranslation()
  const step = study.steps[study.selected]
  const ladder = study.steps.length > 1
  return (
    <PanelTable
      label={t('Barrel length')}
      className="limits ladder-table barrel-table"
      caption={
        ladder
          ? t('Barrel length study, step {step} (simulation)', { step: step?.label ?? '' })
          : t('Barrel length study (simulation)')
      }
      columns={columns.map((c) => t(c))}
    >
      {(step?.rows ?? []).map((r) => (
        <tr key={r.length} aria-current={r.current ? 'true' : undefined}>
          <td data-label={t('Barrel length')} className="num">
            {formatQuantity('barrelLength', system, r.length)} {system.barrelLength.symbol}
            {r.current && (
              <span className="barrel-current">
                {' '}
                {study.atSeating ? t('current') : t('run travel')}
              </span>
            )}
          </td>
          {r.values ? (
            <>
              <td data-label={t('Muzzle velocity')} className="num">
                {formatQuantity('velocity', system, r.values.velocity)} {system.velocity.symbol}
              </td>
              <td data-label={t('Muzzle energy')} className="num">
                {formatQuantity('energy', system, r.values.energy)} {system.energy.symbol}
              </td>
              <td data-label={t('Muzzle pressure')} className="num">
                {formatQuantity('pressure', system, r.values.breechPressure)}{' '}
                {system.pressure.symbol}
              </td>
              <td data-label={t('Burnt at muzzle')} className="num">
                {formatNumber(r.values.burntFraction * 100, 0)} %
              </td>
              <td data-label={t('Barrel time')} className="num">
                {msText(r.values.barrelTime)}
              </td>
            </>
          ) : (
            <td data-label={t('Result')} colSpan={5}>
              {study.pending
                ? t('Longer run pending')
                : t('Not computed: {reason}', {
                    reason: reasonText(r.reason ?? study.message ?? 'longer run not requested', t),
                  })}
            </td>
          )}
          <td data-label={t('Values from')}>{r.source === 'run' ? t('run') : t('longer run')}</td>
        </tr>
      ))}
    </PanelTable>
  )
}

/** The Barrel length tab: the range, and the table or the chart. */
export function BarrelLength({ study, system }: { study: BarrelStudy; system: UnitSystem }) {
  const { t } = useTranslation()
  const [pane, setPane] = useState('Table')
  // every invalid field gives its reason: the field holds its own, spoken as its description
  const reasons = rangeSpecs.flatMap((s) => study.errors?.[s.key] ?? [])
  const first = reasons.length > 0 ? reasons.join(' ') : undefined
  const failed =
    study.message &&
    t('Longer run failed: {message}', { message: translateMessage(study.message, t) })
  const text = first ?? (study.pending ? t('Longer run pending') : failed)
  if (study.base === undefined)
    return (
      <p className="prompt empty-state">
        {t(
          'Seat a bullet in the cartridge figure: the barrel length is the seated base plus the travel.',
        )}
      </p>
    )
  return (
    <div className="barrel-length">
      <div className="barrel-range">
        {rangeSpecs.map((spec) => (
          <NumberField
            key={spec.key}
            spec={spec}
            system={system}
            value={study.range[spec.key]}
            onChange={(v) => study.setRange(spec.key, v)}
            error={study.errors?.[spec.key]}
            hiddenError
          />
        ))}
        <SegmentedControl
          size={controlSize.row.toggle}
          aria-label={t('Barrel length view')}
          data={[
            { value: 'Table', label: t('Table') },
            { value: 'Chart', label: t('Chart') },
          ]}
          value={pane}
          onChange={setPane}
        />
      </div>
      <p className="barrel-status" data-error={first ? '' : undefined} role="status">
        <span className="barrel-status-text" title={text}>
          {text}
        </span>
        {!first && !study.pending && study.message && (
          <Button size={controlSize.row.button} variant="default" ml="xs" onClick={study.retry}>
            {t('Retry')}
          </Button>
        )}
      </p>
      {study.errors ? null : pane === 'Chart' ? (
        <BarrelChart steps={study.steps} selected={study.selected} system={system} />
      ) : (
        <BarrelTable study={study} system={system} />
      )}
    </div>
  )
}
