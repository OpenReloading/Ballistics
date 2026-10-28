'use client'

import { Button, Group, TextInput } from '@mantine/core'
import type { InteriorLoad } from '@open-reloading/core'
import { chronoSession, parseRef, type SessionRecord } from '@open-reloading/schema'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, parseNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { chargeRows } from '../lib/measurements.ts'
import { openOnWorkbench } from '../lib/open-loads.ts'
import type { PowderFitState } from '../lib/powder-fit.ts'
import {
  loadStrings,
  loadsWithPowder,
  parseVelocities,
  type TuneString,
  tunePowder,
  tuneSessionIds,
} from '../lib/powder-tune.ts'
import { readTuneLoad } from '../lib/tune-load.ts'
import { withUnit } from '../lib/units.ts'
import { storedRecord, storedRecords } from '../lib/user-store.ts'
import { PageBar } from './page-bar.tsx'
import { PanelTable } from './scroll-region.tsx'
import { ErrorNote, Message } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { usePowderFit } from './use-powder-fit.ts'

/** The stored sessions `ids` that are valid session records, in order; a missing one is left out. */
async function readSessions(ids: string[]) {
  const records = await Promise.all(ids.map((id) => storedRecord(id).catch(() => undefined)))
  return records.filter(
    (r): r is SessionRecord => r?.kind === 'session' && chronoSession.safeParse(r.data).success,
  )
}

const labels = { tight: msg('tight'), moderate: msg('moderate'), loose: msg('loose') }

/** The state of the fit: the fitted vivacity once it has arrived, then the width of its pressure range. */
function FitResult({ state }: { state: PowderFitState }) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const { fit, range, failure } = state
  const rate = fit?.fit.parameters.find((p) => p.name === 'burnRate')
  return (
    <div role="status" className="powder-fit-state">
      {rate && (
        <p>
          {rate.standardUncertainty === undefined
            ? t('Fitted vivacity: {value}', { value: withUnit('vivacity', system, rate.value) })
            : t('Fitted vivacity: {value}, standard uncertainty {u}', {
                value: withUnit('vivacity', system, rate.value),
                u: withUnit('vivacity', system, rate.standardUncertainty),
              })}
        </p>
      )}
      {range && (
        <p>
          {t('Pressure range: {label}, plus and minus {percent} %', {
            label: t(labels[range.confidence.label]),
            percent: formatNumber(range.range.relativeHalfWidth * 100, 1),
          })}
        </p>
      )}
      {state.running && <p>{rate ? t('Working out the pressure range') : t('Fitting')}</p>}
      {failure && (
        <Message severity="warning">
          {failure.kind === 'refused'
            ? t('No fit: {reason}', { reason: translateMessage(failure.reason, t) })
            : translateMessage(failure.message, t)}
        </Message>
      )}
    </div>
  )
}

/**
 * What the screen says of the load the strings name: save it first, open it on the workbench when
 * no load was handed over, the strings of another load left out, and the fit once it runs.
 */
export function TuneNotes({
  loaded,
  interior,
  fit,
}: {
  loaded: ReturnType<typeof loadStrings> | undefined
  interior: InteriorLoad | undefined
  fit: PowderFitState
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const c = system.charge
  const loadId = loaded?.load && parseRef(loaded.load)?.id
  return (
    <>
      {loaded && loaded.strings.length > 0 && !loaded.load && (
        <p className="note">{t('Save the load to fit a powder from its strings.')}</p>
      )}
      {loadId && !interior && (
        <p className="note">
          <Link href="/workbench" onClick={() => openOnWorkbench(loadId)}>
            {t('Open this load in the workbench and follow its Measurements link to fit a powder.')}
          </Link>
        </p>
      )}
      {loaded && loaded.left.length > 0 && (
        <p className="note">
          {t('Left out, the strings of another load at {charges} {unit}', {
            charges: loaded.left
              .map((s) => formatNumber(c.fromSi(s.charge), c.decimals))
              .join(', '),
            unit: c.symbol,
          })}
        </p>
      )}
      {interior && <FitResult state={fit} />}
    </>
  )
}

/**
 * The powder tuning screen: the chronograph strings of the sessions the link names (`?session=`)
 * and those added here, with mean, SD and shot count per charge, and the fit from the load the
 * workbench handed over for their load. Opened for a powder (`?powder=`), it lists the saved loads
 * that use it.
 */
export function PowderTune() {
  const { t, tn } = useTranslation()
  const { system } = useUnits()
  const [loaded, setLoaded] = useState<ReturnType<typeof loadStrings>>()
  const [interior, setInterior] = useState<InteriorLoad>()
  const [choices, setChoices] = useState<{ id: string; name: string }[]>()
  const [added, setAdded] = useState<TuneString[]>([])
  const [form, setForm] = useState({ charge: '', shots: '' })
  const [error, setError] = useState(false)

  useEffect(() => {
    const ids = tuneSessionIds(window.location.search)
    const powder = tunePowder(window.location.search)
    if (ids.length > 0)
      readSessions(ids).then((s) => {
        const found = loadStrings(s)
        setLoaded(found)
        if (found.load) setInterior(readTuneLoad(found.load))
      })
    else if (powder)
      storedRecords()
        .then(({ records }) => setChoices(loadsWithPowder(records, powder)))
        .catch(() => setChoices([]))
  }, [])

  const c = system.charge
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const strings = useMemo(() => [...(loaded?.strings ?? []), ...added], [loaded, added])
  const rows = chargeRows(strings, [])
  const fit = usePowderFit(interior, strings)

  function add() {
    const charge = parseNumber(form.charge, { min: 0 })
    const shots = parseVelocities(form.shots, v.toSi)
    if (charge.kind !== 'number' || !(charge.value > 0) || !shots) {
      setError(true)
      return
    }
    setError(false)
    setAdded((a) => [
      ...a,
      { charge: c.toSi(charge.value), shots: shots.map((value) => ({ velocity: { value } })) },
    ])
    setForm({ charge: '', shots: '' })
  }

  return (
    <>
      <PageBar
        title={msg('Tune a powder')}
        translated
        status={<span role="status">{tn(rows.length, '{count} charge', '{count} charges')}</span>}
        actions={<UnitsIconButton />}
      />
      <div className="sheet powder-tune">
        {rows.length > 0 ? (
          <PanelTable
            label={t('Strings per charge')}
            caption={t('Strings per charge')}
            columns={[
              t('Charge ({unit})', { unit: c.symbol }),
              t('Shots'),
              t('Mean ({unit})', { unit: v.symbol }),
              t('SD ({unit})', { unit: v.symbol }),
            ]}
          >
            {rows.map((r) => (
              <tr key={r.charge}>
                <td className="num">{formatNumber(c.fromSi(r.charge), c.decimals)}</td>
                <td className="num">{r.velocityStats?.count ?? 0}</td>
                <td className="num">{r.velocityStats ? speed(r.velocityStats.mean) : ''}</td>
                <td className="num">
                  {r.velocityStats?.standardDeviation === undefined
                    ? ''
                    : speed(r.velocityStats.standardDeviation)}
                </td>
              </tr>
            ))}
          </PanelTable>
        ) : (
          <p className="prompt empty-state">
            {t(
              'Add a string, or open this page from the Measurements tab of a load with chronograph strings mapped to charges.',
            )}
          </p>
        )}
        <TuneNotes loaded={loaded} interior={interior} fit={fit} />
        {choices &&
          (choices.length > 0 ? (
            <nav aria-label={t('Saved loads with this powder')}>
              <p>
                {t(
                  'Choose a saved load with strings of this powder. It opens in the workbench, where its Measurements link fits the powder.',
                )}
              </p>
              <ul>
                {choices.map((l) => (
                  <li key={l.id}>
                    <Link href="/workbench" onClick={() => openOnWorkbench(l.id)}>
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <p className="note">
              {t(
                "No saved load uses this powder. Open a saved load's Measurements tab to fit a powder from its strings.",
              )}
            </p>
          ))}
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault()
            add()
          }}
        >
          <Group gap="xs" align="end" wrap="wrap" my="xs">
            <TextInput
              label={t('Charge ({unit})', { unit: c.symbol })}
              inputMode="decimal"
              value={form.charge}
              onChange={(e) => setForm({ ...form, charge: e.currentTarget.value })}
              w="8rem"
            />
            <TextInput
              label={t('Shot velocities ({unit})', { unit: v.symbol })}
              description={t('Separated by spaces')}
              value={form.shots}
              onChange={(e) => setForm({ ...form, shots: e.currentTarget.value })}
              style={{ flex: 1, minWidth: '12rem' }}
            />
            <Button type="submit" variant="default">
              {t('Add a string')}
            </Button>
          </Group>
        </form>
        {error && (
          <ErrorNote title={t('The string was not added.')}>
            {t('Enter a charge and at least one shot velocity, each a positive number.')}
          </ErrorNote>
        )}
        <p className="note">{t('All values on this screen are simulations, not load data.')}</p>
      </div>
    </>
  )
}
