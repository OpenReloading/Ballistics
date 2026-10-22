'use client'

import { Button } from '@mantine/core'
import { useState } from 'react'
import { bandNote, describeCurve, type FittedPowder, modelCaption } from '../lib/burn-rate.ts'
import { formatNumber } from '../lib/units.ts'
import { CurveTable } from './curve-table.tsx'
import { LazyVivacityChart } from './lazy-vivacity-chart.tsx'
import { Panel } from './panel.tsx'

/**
 * A fitted powder's Dynamic vivacity panel: the curve with its band and the burn form's `z1` as a
 * marked line, the legend and the model caption, and the curve values behind the Curve values
 * button in the title row (printed open).
 */
export function VivacityPanel({ powder, z1 }: { powder: FittedPowder; z1?: number }) {
  const [open, setOpen] = useState(false)
  // z1 of 1 is the end of the axis: a one-stage form, nothing to mark
  const marks = z1 !== undefined && z1 < 1 ? [{ z: z1, label: `z1 ${formatNumber(z1, 1)}` }] : []
  return (
    <Panel
      id="vivacity-curve"
      title="Dynamic vivacity"
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
          Curve values
        </Button>
      }
    >
      <div className="burn-rate-curve">
        <LazyVivacityChart
          series={[{ powder, slot: 0 }]}
          title={`Dynamic vivacity of ${powder.label}, model output`}
          description={describeCurve(powder)}
          marks={marks}
        />
        <ul className="curve-legend">
          <li>
            <span className="curve-key curve-key-line" aria-hidden="true" />
            Fitted M3 curve
          </li>
          <li>
            <span className="curve-key curve-key-band" aria-hidden="true" />
            {bandNote.charAt(0).toUpperCase() + bandNote.slice(1)}
          </li>
        </ul>
        <p className="screen-only record-note">{modelCaption}</p>
      </div>
      <div id="curve-values" className="curve-values" data-open={open || undefined}>
        <CurveTable powders={[powder]} caption={`Dynamic vivacity of ${powder.label}`} />
      </div>
    </Panel>
  )
}
