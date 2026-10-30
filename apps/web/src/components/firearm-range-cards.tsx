'use client'

import type { Bullet } from '@open-reloading/schema'
import { Fragment, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import type { Say } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { errorText } from '../lib/error-text.ts'
import {
  cardResult,
  firearmCardPlans,
  type LoadCard,
  type MeasuredVelocity,
} from '../lib/firearm-range-cards.ts'
import {
  fetchManufacturerNames,
  noManufacturerNames,
  withUserManufacturers,
} from '../lib/manufacturers.ts'
import type { UnitSystem } from '../lib/units.ts'
import { storedRecords } from '../lib/user-store.ts'
import { printAlone, usePortalBody } from './print.ts'
import { RangeCard } from './range-card.tsx'

/** One saved load of the firearm: its card with the velocity it used, or why it has none. */
export type LoadRangeCard = { id: string; name: string } & (
  | { result: LoadCard; velocity: MeasuredVelocity }
  | { reason: Say }
)

/** The cards of the saved loads of the firearm `firearmId`, read from the store and computed. */
export async function firearmCards(
  firearmId: string,
  system: UnitSystem,
): Promise<LoadRangeCard[]> {
  const { records } = await storedRecords()
  const names = withUserManufacturers(
    await fetchManufacturerNames().catch(() => noManufacturerNames),
    records,
  )
  return Promise.all(
    firearmCardPlans(records, firearmId).map(async (plan): Promise<LoadRangeCard> => {
      const base = { id: plan.id, name: plan.name }
      if ('reason' in plan) return { ...base, reason: (t) => t(plan.reason) }
      try {
        const record = await fetchRecord<Bullet>('bullets', plan.bullet)
        if (!record) return { ...base, reason: (t) => t('The bullet record was not found.') }
        const card = cardResult(plan, record, names, system)
        if ('reason' in card) return { ...base, reason: (t) => t(card.reason) }
        return { ...base, result: card, velocity: plan.velocity }
      } catch (e) {
        const text = errorText(e)
        return { ...base, reason: (t) => translateMessage(text, t) }
      }
    }),
  )
}

/**
 * The range cards of a firearm's loads, rendered into `body` and printed alone on A4 once they are
 * there, each after a line naming its load and its measured velocity; the loads without a card
 * follow, each with its reason. `onDone` runs when the print dialog closes.
 */
export function FirearmRangeCards({
  cards,
  system,
  onDone,
}: {
  cards: LoadRangeCard[]
  system: UnitSystem
  onDone: () => void
}) {
  const { t, tn } = useTranslation()
  const body = usePortalBody()
  const printed = cards.flatMap((c) => ('result' in c ? [c] : []))
  const skipped = cards.flatMap((c) => ('reason' in c ? [c] : []))
  // each printed load is a line and a card, the skipped loads one list
  const parts = 2 * printed.length + (skipped.length > 0 ? 1 : 0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: prints once, the cards are fixed
  useEffect(() => {
    // the cards' portals mount a render after this one
    let frame = 0
    let tries = 0
    const ready = () => {
      if (document.querySelectorAll('body > .range-card').length >= parts || ++tries > 60)
        printAlone('range-card', onDone)
      else frame = requestAnimationFrame(ready)
    }
    frame = requestAnimationFrame(ready)
    return () => cancelAnimationFrame(frame)
  }, [])
  if (!body) return null
  return (
    <>
      {printed.map((c) => (
        <Fragment key={c.id}>
          {createPortal(
            <div className="range-card range-card-load" data-paper="a4">
              <p>
                <strong>{t('Load: {name}', { name: c.name })}</strong>
              </p>
              <p>
                {tn(
                  c.velocity.shots,
                  'Muzzle velocity measured: mean of {count} shot',
                  'Muzzle velocity measured: mean of {count} shots',
                )}
                {c.velocity.date && `, ${c.velocity.date}`}
              </p>
            </div>,
            body,
          )}
          <RangeCard result={c.result} system={system} paper="a4" />
        </Fragment>
      ))}
      {skipped.length > 0 &&
        createPortal(
          <div className="range-card range-card-skipped" data-paper="a4">
            <p>
              <strong>{t('Loads without a range card')}</strong>
            </p>
            <ul>
              {skipped.map((c) => (
                <li key={c.id}>{t('{name}: {reason}', { name: c.name, reason: c.reason(t) })}</li>
              ))}
            </ul>
          </div>,
          body,
        )}
    </>
  )
}
