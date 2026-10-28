/** The reminder to export the saved loads: its counts, stored state and text. */
import type { Translator } from '../i18n/translate.ts'
import { storageName } from './edition.ts'

/** What the export reminder counts (`localStorage` `exportReminder`). */
export type ExportReminder = {
  exportedAt?: string | undefined
  firstChangeAt?: string | undefined
  changes: number
}

export const reminderKey = storageName('exportReminder')
const reminderChanges = 10
const reminderDays = 7

export const afterChange = (r: ExportReminder, now: Date): ExportReminder => ({
  ...r,
  firstChangeAt: r.firstChangeAt ?? now.toISOString(),
  changes: r.changes + 1,
})

export const afterExport = (now: Date): ExportReminder => ({
  exportedAt: now.toISOString(),
  changes: 0,
})

/** A stored reminder state; anything damaged reads as no changes. */
export function parseReminder(text: string | null): ExportReminder {
  try {
    const j = JSON.parse(text ?? 'null') as Partial<ExportReminder> | null
    const date = (x: unknown) =>
      typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : undefined
    const changes =
      Number.isInteger(j?.changes) && (j?.changes as number) > 0 ? (j?.changes as number) : 0
    return { exportedAt: date(j?.exportedAt), firstChangeAt: date(j?.firstChangeAt), changes }
  } catch {
    return { changes: 0 }
  }
}

/** The reminder to export, once 10 saves or 7 days since the last export (or first save) have passed. */
export function reminderText(
  r: ExportReminder,
  now: Date,
  t: Translator['t'],
  tn: Translator['tn'],
): string | undefined {
  if (r.changes < 1) return undefined
  const since = r.exportedAt ?? r.firstChangeAt
  const days = since ? Math.floor((now.getTime() - Date.parse(since)) / 86_400_000) : 0
  if (r.changes < reminderChanges && days < reminderDays) return undefined
  const saves = tn(r.changes, '{count} save', '{count} saves')
  if (!r.exportedAt) return t('{saves}, never exported.', { saves })
  return days >= reminderDays
    ? t('{saves} since the last export, {days} days ago.', { saves, days })
    : t('{saves} since the last export.', { saves })
}
