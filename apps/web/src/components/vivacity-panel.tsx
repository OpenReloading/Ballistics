'use client'

import { useLingui } from '@lingui/react'
import { Button } from '@mantine/core'
import { useState } from 'react'
import { loadEnglish } from '../i18n/lingui.ts'
import { formatNumber } from '../i18n/number.ts'
import { bandNote, describeCurve, type FittedPowder, modelCaption } from '../lib/burn-rate.ts'
import englishMessages from '../locales/en/components/vivacity-panel.json' with { type: 'json' }
import { CurveTable } from './curve-table.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { Panel } from './panel.tsx'

loadEnglish(englishMessages)

/** The curve values sit behind the Curve values button in the title row and print open. */
export function VivacityPanel({ powder, z1 }: { powder: FittedPowder; z1?: number | undefined }) {
  const { i18n } = useLingui()
  const [open, setOpen] = useState(false)
  // z1 of 1 is the end of the axis: a one-stage form, nothing to mark
  const marks =
    z1 !== undefined && z1 < 1
      ? [
          {
            z: z1,
            label: i18n._({
              id: 'powderRecord.z1',
              message: 'z1 {z}',
              values: { z: formatNumber(z1, 1) },
            }),
          },
        ]
      : []
  return (
    <Panel
      id="vivacity-curve"
      title={/*i18n*/ { id: 'powderRecord.vivacity', message: 'Dynamic vivacity' }}
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
          {i18n._({ id: 'powderRecord.curveValues', message: 'Curve values' })}
        </Button>
      }
    >
      <div className="burn-rate-curve">
        <LazyVivacityChart
          series={[{ powder, slot: 0 }]}
          title={i18n._({
            id: 'powderRecord.vivacityOf',
            message: 'Dynamic vivacity of {label}, model output',
            values: { label: powder.label },
          })}
          description={describeCurve(powder, i18n)}
          marks={marks}
        />
        <ul className="curve-legend">
          <li>
            <span className="curve-key curve-key-line" aria-hidden="true" />
            {i18n._({ id: 'powderRecord.fittedCurve', message: 'Fitted M3 curve' })}
          </li>
          <li>
            <span className="curve-key curve-key-band" aria-hidden="true" />
            {i18n._(bandNote)}
          </li>
        </ul>
        <p className="screen-only record-note">{i18n._(modelCaption)}</p>
      </div>
      <div id="curve-values" className="curve-values" data-open={open || undefined}>
        <CurveTable
          powders={[powder]}
          caption={i18n._({
            id: 'powderRecord.vivacityTable',
            message: 'Dynamic vivacity of {label}',
            values: { label: powder.label },
          })}
        />
      </div>
    </Panel>
  )
}
