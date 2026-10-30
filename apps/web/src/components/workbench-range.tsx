'use client'

import { ActionIcon, Button, Popover } from '@mantine/core'
import { Info } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { bandLine, rangeCardNote, rangeHero, resultBand } from '../lib/workbench.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { printAlone } from './print.ts'
import { useInputEcho, useLoad, useResult } from './workbench-context.ts'
import { derived, type Outcome, selectedLabel } from './workbench-outcome.ts'
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

/** Whether 2 s passed since the run: the card follows a run after the trajectory's 150 ms delay. */
function useWaited(runId: number | undefined) {
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    setWaited(false)
    if (runId === undefined) return
    const timer = setTimeout(() => setWaited(true), 2000)
    return () => clearTimeout(timer)
  }, [runId])
  return waited
}

/** The peak pressure with its share of the limit and the help a tap reaches. */
function PeakPressure({
  ok,
  system,
}: {
  ok: Extract<Outcome, { kind: 'ok' }>
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const ofMax = derived(ok, t).ofMax
  const band = resultBand(ok.body)
  const p = (pa: number) => withUnit('pressure', system, pa)
  return (
    <>
      <dl>
        <div>
          <dt>{t('Peak pressure')}</dt>
          <dd>{p(ok.body.pressureRange.nominalPressure)}</dd>
          <dd className="readout-note">
            <span className="visually-hidden">
              {band.sampled ? t('5th to 95th percentile') : t('range')}{' '}
            </span>
            {t('{low} to {high}', {
              low: formatQuantity('pressure', system, band.pressure.low),
              high: p(band.pressure.high),
            })}
          </dd>
        </div>
        {ofMax?.limit.pressure && (
          <div>
            <dt>{t('Percent of maximum')}</dt>
            <dd>{formatNumber(ofMax.percent, 0)} %</dd>
            <dd className="readout-note">
              {t('of CIP {symbol} {limit}', {
                symbol: ofMax.limit.symbol,
                limit: p(ofMax.limit.pressure),
              })}
            </dd>
          </div>
        )}
      </dl>
      <AppPopover position="bottom-end" width={popoverWidth.help} trapFocus>
        <Popover.Target>
          <ActionIcon variant="subtle" size={44} aria-label={t('About the peak pressure')}>
            <Info size={24} aria-hidden="true" />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <p className="range-help">{peakFacts(ok, system, t)}</p>
        </Popover.Dropdown>
      </AppPopover>
    </>
  )
}

/**
 * The phone range view: the tab "Range" below 48em.
 * The shown step's charge and muzzle velocity first, the ladder strip with touch-sized cells, the
 * peak pressure with help a tap reaches, the chronograph import and the range card. It reads the
 * result context, so it shows what the Results tab shows.
 */
export function RangeView() {
  const { t } = useTranslation()
  const { ok, steps, stale, system, setSeen, chronoSessions, setChronoSessions } = useResult()
  const { run, pending } = useLoad()
  const { trajectoryLoad } = useInputEcho()
  const [chrono, setChrono] = useState(false)
  const card = useRangeCard()
  // the range card is the Trajectory tab's result: mounting the tab (hidden) computes it
  const runId = ok?.id
  const waited = useWaited(runId)
  useEffect(() => {
    if (runId !== undefined)
      setSeen((s) => (s.has('trajectory') ? s : new Set([...s, 'trajectory'])))
  }, [runId, setSeen])
  const stepName = ok && ok.steps.length > 1 ? selectedLabel(ok) : undefined
  const hero = ok && rangeHero(system, ok.load.charge, ok.body.result.muzzleVelocity, stepName, t)
  return (
    <section className="range-view" aria-label={t('Range')}>
      {/* always there, so a run moves nothing */}
      <dl className="range-hero" data-stale={stale || undefined}>
        <div>
          <dt>{stepName ? t('Charge, step {label}', { label: stepName }) : t('Charge')}</dt>
          <dd>
            {hero?.charge.value} <span>{hero?.charge.unit}</span>
          </dd>
        </div>
        <div>
          <dt>{t('Muzzle velocity')}</dt>
          <dd>
            {hero?.velocity.value} <span>{hero?.velocity.unit}</span>
          </dd>
        </div>
      </dl>
      <ShownStrip name="range-step" />
      <div className="range-peak">{ok && <PeakPressure ok={ok} system={system} />}</div>
      {ok && bandLine(ok.body, system, t) && (
        <p className="range-needs band-line screen-only">{bandLine(ok.body, system, t)}</p>
      )}
      <div id="range-chrono" hidden={!chrono}>
        {chrono && (
          <Measurements
            idPrefix="range-measurements"
            steps={measuredSteps(steps, ok)}
            system={system}
            sessions={chronoSessions}
            setSessions={setChronoSessions}
          />
        )}
      </div>
      <div className="range-bottom">
        <span className="range-state">{stale && t('Inputs changed since this result.')}</span>
        <Button
          size="lg"
          variant={stale || !ok ? 'filled' : 'default'}
          loading={pending}
          loaderProps={{ type: 'dots' }}
          onClick={() => run()}
        >
          {t('Run simulation')}
        </Button>
        <div className="range-actions">
          <Button
            variant="default"
            size="md"
            aria-expanded={chrono}
            aria-controls="range-chrono"
            onClick={() => setChrono((c) => !c)}
          >
            {t('Chronograph')}
          </Button>
          <Button
            variant="default"
            size="md"
            disabled={!card}
            aria-describedby={card ? undefined : 'range-card-needs'}
            // the range card's own module stays with the Trajectory tab, which renders the card
            onClick={() => printAlone('range-card')}
          >
            {t('Print range card')}
          </Button>
        </div>
        <p id="range-card-needs" className="range-needs">
          {rangeCardNote(ok !== undefined, trajectoryLoad.bullet, waited && !card, t)}
        </p>
      </div>
    </section>
  )
}
