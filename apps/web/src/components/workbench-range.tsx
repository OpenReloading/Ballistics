'use client'

import { ActionIcon, Button, Popover } from '@mantine/core'
import { Info } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { formatNumber, formatQuantity, withUnit } from '../lib/units.ts'
import { rangeCardNote, rangeHero, resultBand } from '../lib/workbench.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { printRangeCard } from './range-card.tsx'
import { useInputEcho, useLoad, useResult } from './workbench-context.ts'
import { derived, selectedLabel } from './workbench-outcome.ts'
import { peakFacts } from './workbench-readouts.tsx'
import { Measurements, measuredSteps, ShownStrip } from './workbench-results.tsx'

/** Whether a range card of the Trajectory tab's result is in the page (it renders into `body`). */
function useRangeCard() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const check = () => setReady(document.querySelector('.range-card') !== null)
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [])
  return ready
}

/**
 * The phone range view: the tab "Range" below 48em.
 * The shown step's charge and muzzle velocity first, the ladder strip with touch-sized cells, the
 * peak pressure with help a tap reaches, the chronograph import and the range card. It reads the
 * result context, so it shows what the Results tab shows.
 */
export function RangeView() {
  const { ok, steps, stale, system, setSeen, chronoSeries, setChronoSeries, online } = useResult()
  const { run, pending } = useLoad()
  const { trajectoryLoad } = useInputEcho()
  const [chrono, setChrono] = useState(false)
  const card = useRangeCard()
  // the range card is the Trajectory tab's result: mounting the tab (hidden) computes it
  const runId = ok?.id
  // the card follows a run after the trajectory's 150 ms delay: a reason is named after a pause
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    setWaited(false)
    if (runId === undefined) return
    const timer = setTimeout(() => setWaited(true), 2000)
    return () => clearTimeout(timer)
  }, [runId])
  useEffect(() => {
    if (runId !== undefined)
      setSeen((s) => (s.has('trajectory') ? s : new Set([...s, 'trajectory'])))
  }, [runId, setSeen])
  const hero =
    ok &&
    rangeHero(
      system,
      ok.load.charge,
      ok.body.result.muzzleVelocity,
      ok.steps.length > 1 ? selectedLabel(ok) : undefined,
    )
  const ofMax = ok && derived(ok).ofMax
  const p = (pa: number) => withUnit('pressure', system, pa)
  return (
    <section className="range-view" aria-label="Range">
      {/* always there, so a run moves nothing */}
      <dl className="range-hero" data-stale={stale || undefined}>
        <div>
          <dt>{hero?.step ? `Charge, ${hero.step.toLowerCase()}` : 'Charge'}</dt>
          <dd>
            {hero?.charge.value} <span>{hero?.charge.unit}</span>
          </dd>
        </div>
        <div>
          <dt>Muzzle velocity</dt>
          <dd>
            {hero?.velocity.value} <span>{hero?.velocity.unit}</span>
          </dd>
        </div>
      </dl>
      <ShownStrip name="range-step" />
      <div className="range-peak">
        {ok && (
          <>
            <dl>
              <div>
                <dt>Peak pressure</dt>
                <dd>{p(ok.body.pressureRange.nominalPressure)}</dd>
                <dd className="readout-note">
                  <span className="visually-hidden">
                    {resultBand(ok.body).sampled ? '5th to 95th percentile ' : 'range '}
                  </span>
                  {formatQuantity('pressure', system, resultBand(ok.body).pressure.low)} to{' '}
                  {p(resultBand(ok.body).pressure.high)}
                </dd>
              </div>
              {ofMax?.limit.pressure && (
                <div>
                  <dt>Percent of maximum</dt>
                  <dd>{formatNumber(ofMax.percent, 0)} %</dd>
                  <dd className="readout-note">
                    of CIP {ofMax.limit.symbol} {p(ofMax.limit.pressure)}
                  </dd>
                </div>
              )}
            </dl>
            <AppPopover position="bottom-end" width={popoverWidth.help} trapFocus>
              <Popover.Target>
                <ActionIcon variant="subtle" size={44} aria-label="About the peak pressure">
                  <Info size={24} aria-hidden="true" />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <p className="range-help">{peakFacts(ok, system)}</p>
              </Popover.Dropdown>
            </AppPopover>
          </>
        )}
      </div>
      <div id="range-chrono" hidden={!chrono}>
        {chrono && (
          <Measurements
            idPrefix="range-measurements"
            steps={measuredSteps(steps, ok)}
            system={system}
            series={chronoSeries}
            setSeries={setChronoSeries}
          />
        )}
      </div>
      <div className="range-bottom">
        <span className="range-state">{stale && 'Inputs changed since this result.'}</span>
        <Button
          size="lg"
          variant={stale || !ok ? 'filled' : 'default'}
          loading={pending}
          loaderProps={{ type: 'dots' }}
          aria-describedby={online ? undefined : 'run-network-hint'}
          onClick={() => run()}
        >
          Run simulation
        </Button>
        <div className="range-actions">
          <Button
            variant="default"
            size="md"
            aria-expanded={chrono}
            aria-controls="range-chrono"
            onClick={() => setChrono((c) => !c)}
          >
            Chronograph
          </Button>
          <Button
            variant="default"
            size="md"
            disabled={!card}
            aria-describedby={card ? undefined : 'range-card-needs'}
            onClick={printRangeCard}
          >
            Print range card
          </Button>
        </div>
        <p id="range-card-needs" className="range-needs">
          {rangeCardNote(ok !== undefined, trajectoryLoad.bullet, waited && !card)}
        </p>
      </div>
    </section>
  )
}
