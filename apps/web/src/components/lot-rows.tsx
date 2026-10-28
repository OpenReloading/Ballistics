'use client'

import { Button, NumberInput, Text } from '@mantine/core'
import dynamic from 'next/dynamic'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import type { FieldSpec } from '../lib/field-spec.ts'
import { defaultLotFraction, maxLotFraction } from '../lib/lot-rows.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import type { LotRows } from './use-lot-rows.ts'

const loadChart = () => import('./lot-chart.tsx').then((m) => m.LotChart)

const LotChart = dynamic(loadChart, {
  ssr: false,
  loading: () => <div className="chart lot-chart" />,
})

/** Fetches the chart's code, so a print asked before the tab was opened finds it loaded. */
export function preloadLotChart() {
  loadChart().catch(() => {})
}

export const fractionSpec: FieldSpec = {
  key: 'lotFraction',
  label: msg('Lot burn rate change'),
  help: msg(
    'The two extra rows of each charge burn this much faster and slower than the powder record.',
  ),
  quantity: 'percent',
  required: true,
  min: 0,
  max: maxLotFraction * 100,
  positive: true,
  initial: defaultLotFraction,
}

/** What the lot rows say about barrel time: a computed value of the simulation. */
export const lotNote = msg(
  'Lot rows: the burn rate of each charge raised and lowered. Barrel time is a computed value of the simulation, not a measurement.',
)

/** The chart of the lot rows' barrel times, with the note under it; nothing before the rows arrive. */
export function LotChartBlock({
  lot,
  system,
  note = true,
}: {
  lot: LotRows
  system: UnitSystem
  /** The note under the chart; the printed report carries none. */
  note?: boolean
}) {
  const { t } = useTranslation()
  if (!lot.rows) return null
  return (
    <>
      <LotChart
        times={lot.rows.times}
        fraction={lot.rows.fraction}
        target={lot.targetSeconds}
        system={system}
      />
      {note && <p className="note lot-note">{t(lotNote)}</p>}
    </>
  )
}

/** The fields of the lot rows, the status of their request and the chart. */
export function LotPanel({ lot, system }: { lot: LotRows; system: UnitSystem }) {
  const { t } = useTranslation()
  const first = lot.error
  const failed =
    lot.message && t('Lot rows failed: {message}', { message: translateMessage(lot.message, t) })
  const text = first ?? (lot.pending ? t('Lot rows pending') : failed)
  return (
    <section className="lot-rows" aria-labelledby="lot-rows-title">
      <h3 id="lot-rows-title">{t('Powder lot rows')}</h3>
      <div className="lot-fields">
        <NumberField
          spec={fractionSpec}
          system={system}
          value={lot.percent}
          onChange={lot.setPercent}
          error={first}
          hiddenError
        />
        <NumberInput
          label={t('Target barrel time')}
          description={t('Optional: a line on the chart.')}
          hideControls
          min={0}
          decimalScale={3}
          value={lot.target}
          onChange={lot.setTarget}
          rightSection={
            <Text size="xs" c="dimmed" pr="xs">
              ms
            </Text>
          }
          rightSectionWidth={36}
        />
      </div>
      <p className="barrel-status" data-error={first ? '' : undefined} role="status">
        <span className="barrel-status-text" title={text}>
          {text}
        </span>
        {!first && !lot.pending && lot.message && (
          <Button size={controlSize.row.button} variant="default" ml="xs" onClick={lot.retry}>
            {t('Retry')}
          </Button>
        )}
      </p>
      <LotChartBlock lot={lot} system={system} />
    </section>
  )
}
