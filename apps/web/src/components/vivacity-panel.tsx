'use client'

import { Button } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { describeCurve, type FittedPowder, uncertaintyFactor } from '../lib/burn-rate.ts'
import { CurveTable } from './curve-table.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { Panel } from './panel.tsx'

/**
 * A fitted powder's Dynamic vivacity panel: the curve with its band and the burn form's `z1` as a
 * marked line, the legend and the model caption, and the curve values behind the Curve values
 * button in the title row (printed open).
 */
export function VivacityPanel({ powder, z1 }: { powder: FittedPowder; z1?: number | undefined }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // z1 of 1 is the end of the axis: a one-stage form, nothing to mark
  const marks = z1 !== undefined && z1 < 1 ? [{ z: z1, label: `z1 ${formatNumber(z1, 1)}` }] : []
  return (
    <Panel
      id="vivacity-curve"
      title={t('Dynamic vivacity')}
      className="vivacity-panel"
      controls={
        <Button
          className="curve-toggle"
          variant={open ? 'light' : 'subtle'}
          size="compact-xs"
          aria-expanded={open}
          aria-controls="curve-values"
          onClick={() => setOpen((o) => !o)}
        >
          {t('Curve values')}
        </Button>
      }
    >
      <div className="burn-rate-curve">
        <LazyVivacityChart
          series={[{ powder, slot: 0 }]}
          title={t('Dynamic vivacity of {name}, model output', { name: powder.label })}
          description={describeCurve(powder, t)}
          marks={marks}
        />
        <ul className="curve-legend">
          <li>
            <span className="curve-key curve-key-line" aria-hidden="true" />
            {t('Fitted M3 curve')}
          </li>
          <li>
            <span className="curve-key curve-key-band" aria-hidden="true" />
            {t(
              'Plus and minus {factor} standard uncertainties of the fitted vivacity, a lower bound',
              { factor: uncertaintyFactor },
            )}
          </li>
        </ul>
        <p className="screen-only record-note">
          {t('Model output from fitted M3 parameters, not manufacturer data.')}
        </p>
      </div>
      <div id="curve-values" className="curve-values" data-open={open || undefined}>
        <CurveTable
          powders={[powder]}
          caption={t('Dynamic vivacity of {name}', { name: powder.label })}
        />
      </div>
    </Panel>
  )
}
