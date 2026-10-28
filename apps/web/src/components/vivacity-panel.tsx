'use client'

import { Button } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { bandNote, describeCurve, type FittedPowder, modelCaption } from '../lib/burn-rate.ts'
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
  const marks =
    z1 !== undefined && z1 < 1 ? [{ z: z1, label: t('z1 {z}', { z: formatNumber(z1, 1) }) }] : []
  return (
    <Panel
      id="vivacity-curve"
      title={msg('Dynamic vivacity')}
      translated
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
          title={t('Dynamic vivacity of {label}, model output', { label: powder.label })}
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
            {t(bandNote)}
          </li>
        </ul>
        <p className="screen-only record-note">{t(modelCaption)}</p>
      </div>
      <div id="curve-values" className="curve-values" data-open={open || undefined}>
        <CurveTable
          powders={[powder]}
          caption={t('Dynamic vivacity of {label}', { label: powder.label })}
        />
      </div>
    </Panel>
  )
}
