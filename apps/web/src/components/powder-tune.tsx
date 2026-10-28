'use client'

import { Button, Group, TextInput } from '@mantine/core'
import { chronoSession, type SessionRecord } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber, parseNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { chargeRows } from '../lib/measurements.ts'
import {
  parseVelocities,
  sessionStrings,
  type TuneString,
  tuneSessionIds,
} from '../lib/powder-tune.ts'
import { storedRecord } from '../lib/user-store.ts'
import { PageBar } from './page-bar.tsx'
import { PanelTable } from './scroll-region.tsx'
import { ErrorNote } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { usePowderFit } from './use-powder-fit.ts'

/** The stored sessions `ids` that are valid session records, in order; a missing one is left out. */
async function readSessions(ids: string[]) {
  const records = await Promise.all(ids.map((id) => storedRecord(id).catch(() => undefined)))
  return records.filter(
    (r): r is SessionRecord => r?.kind === 'session' && chronoSession.safeParse(r.data).success,
  )
}

/**
 * The powder tuning screen: the chronograph strings of the sessions the link names (`?session=`)
 * and those added here, with mean, SD and shot count per charge.
 */
export function PowderTune() {
  const { t, tn } = useTranslation()
  const { system } = useUnits()
  const [loaded, setLoaded] = useState<TuneString[]>([])
  const [added, setAdded] = useState<TuneString[]>([])
  const [form, setForm] = useState({ charge: '', shots: '' })
  const [error, setError] = useState(false)

  useEffect(() => {
    const ids = tuneSessionIds(window.location.search)
    if (ids.length > 0) readSessions(ids).then((s) => setLoaded(sessionStrings(s)))
  }, [])

  const c = system.charge
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const strings = useMemo(() => [...loaded, ...added], [loaded, added])
  const rows = chargeRows(strings, [])
  // shortcut: the screen has no load yet, so the fit never runs; pass the load once the route has one
  usePowderFit(undefined, strings)

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
