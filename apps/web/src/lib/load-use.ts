import { parseRef, type UserRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'
import { dayText } from './dates.ts'
import { sessionRef } from './measurements.ts'

/** A load's firearm id, its session count and the latest day of its dated sessions. */
export type LoadUse = { firearm?: string | undefined; sessions: number; last?: string | undefined }

/** The saved loads that name a firearm and the latest session day over them. */
export type FirearmUse = { loads: number; last?: string | undefined }

/** The later of two YYYY-MM-DD days, which compare as text. */
const later = (a: string | undefined, b: string | undefined) =>
  a === undefined || (b !== undefined && b > a) ? b : a

/**
 * What the stored records say about loads and firearms, by record id: per load its firearm, its
 * sessions and the last session day; per firearm the loads that name it and their last session day.
 * Sessions without a date count but give no day. Nothing of it is stored.
 */
export function loadUse(records: readonly UserRecord[]) {
  const days = new Map(
    records.flatMap((r) =>
      r.kind === 'session' ? [[sessionRef(r.id), r.data.date] as const] : [],
    ),
  )
  const loads = new Map<string, LoadUse>()
  const firearms = new Map<string, FirearmUse>()
  for (const r of records) {
    if (r.kind !== 'load') continue
    const refs = r.data.sessions ?? []
    const last = refs.reduce<string | undefined>((d, ref) => later(d, days.get(ref)), undefined)
    const target = r.data.firearm === undefined ? undefined : parseRef(r.data.firearm)
    const firearm = target?.scope === 'user' ? target.id : undefined
    loads.set(r.id, { firearm, sessions: refs.length, last })
    if (firearm === undefined) continue
    const f = firearms.get(firearm)
    firearms.set(firearm, { loads: (f?.loads ?? 0) + 1, last: later(f?.last, last) })
  }
  return { loads, firearms }
}

/**
 * The line under a load's name in the saved loads: the name of its firearm, its sessions or
 * "No session", and the last session day.
 */
export const loadUseText = (
  use: LoadUse | undefined,
  firearm: string | undefined,
  { t, tn }: Pick<Translator, 't' | 'tn'>,
) =>
  [
    firearm,
    use?.sessions ? tn(use.sessions, '{count} session', '{count} sessions') : t('No session'),
    use?.last && dayText(use.last),
  ]
    .filter(Boolean)
    .join(' · ')
