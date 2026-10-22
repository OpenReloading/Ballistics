'use client'

import { Button, SegmentedControl } from '@mantine/core'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { FieldSpec } from '../lib/field-spec.ts'
import { controlSize } from '../lib/theme.ts'
import { formatNumber, formatQuantity, msText, type UnitSystem } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { PanelTable } from './scroll-region.tsx'
import type { BarrelStudy, RangeKey } from './use-barrel-study.ts'

const BarrelChart = dynamic(() => import('./barrel-chart.tsx').then((m) => m.BarrelChart), {
  ssr: false,
  loading: () => <div className="chart barrel-chart" />,
})

const rangeSpecs: readonly (FieldSpec & { key: RangeKey })[] = [
  { key: 'from', label: 'From', quantity: 'barrelLength', min: 0 },
  { key: 'to', label: 'To', quantity: 'barrelLength', min: 0 },
  { key: 'step', label: 'Step', quantity: 'barrelLength', min: 0 },
]

const columns = [
  'Barrel length',
  'Muzzle velocity',
  'Muzzle energy',
  'Muzzle pressure',
  'Burnt at muzzle',
  'Barrel time',
  'Values from',
]

/**
 * The rows of the shown step, one per barrel length, the workbench barrel marked. Values up to the
 * barrel are read from the run, longer ones from the longer run.
 */
export function BarrelTable({ study, system }: { study: BarrelStudy; system: UnitSystem }) {
  const step = study.steps[study.selected]
  const ladder = study.steps.length > 1
  return (
    <PanelTable
      label="Barrel length"
      className="limits ladder-table barrel-table"
      caption={`Barrel length study${ladder ? `, step ${step?.label}` : ''} (simulation)`}
      columns={columns}
    >
      {(step?.rows ?? []).map((r) => (
        <tr key={r.length} aria-current={r.current ? 'true' : undefined}>
          <td data-label="Barrel length" className="num">
            {formatQuantity('barrelLength', system, r.length)} {system.barrelLength.symbol}
            {r.current && (
              <span className="barrel-current"> {study.atSeating ? 'current' : 'run travel'}</span>
            )}
          </td>
          {r.values ? (
            <>
              <td data-label="Muzzle velocity" className="num">
                {formatQuantity('velocity', system, r.values.velocity)} {system.velocity.symbol}
              </td>
              <td data-label="Muzzle energy" className="num">
                {formatQuantity('energy', system, r.values.energy)} {system.energy.symbol}
              </td>
              <td data-label="Muzzle pressure" className="num">
                {formatQuantity('pressure', system, r.values.breechPressure)}{' '}
                {system.pressure.symbol}
              </td>
              <td data-label="Burnt at muzzle" className="num">
                {formatNumber(r.values.burntFraction * 100, 0)} %
              </td>
              <td data-label="Barrel time" className="num">
                {msText(r.values.barrelTime)}
              </td>
            </>
          ) : (
            <td data-label="Result" colSpan={5}>
              {study.pending
                ? 'Longer run pending'
                : `Not computed: ${r.reason ?? study.message ?? 'longer run not requested'}`}
            </td>
          )}
          <td data-label="Values from">{r.source}</td>
        </tr>
      ))}
    </PanelTable>
  )
}

/** The Barrel length tab: the range, and the table or the chart. */
export function BarrelLength({ study, system }: { study: BarrelStudy; system: UnitSystem }) {
  const [pane, setPane] = useState('Table')
  // every invalid field gives its reason: the field holds its own, spoken as its description
  const reasons = rangeSpecs.flatMap((s) => study.errors?.[s.key] ?? [])
  const first = reasons.length > 0 ? reasons.join(' ') : undefined
  const failed = study.message && `Longer run failed: ${study.message}`
  const text = first ?? (study.pending ? 'Longer run pending' : failed)
  if (study.base === undefined)
    return (
      <p className="prompt empty-state">
        Seat a bullet in the cartridge figure: the barrel length is the seated base plus the travel.
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
          aria-label="Barrel length view"
          data={['Table', 'Chart']}
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
            Retry
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
