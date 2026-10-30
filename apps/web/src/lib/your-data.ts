import type { UserRecord, UserRecordKind } from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'
import { gapCounts, loadGaps } from './load-gaps.ts'

/** A row of Settings' Your data: a kind of the user's records and the list that shows them. */
interface YourDataKind {
  /** The user record kind the count reads. */
  kind: UserRecordKind
  label: Message
  /** The list route with the Mine filter, or the Firearms page (no other source). */
  href: string
}

/**
 * The kinds of records the user owns, in the order of the Database tabs. There is no row for the
 * disciplines (no user record of that kind).
 */
const yourDataKinds: readonly YourDataKind[] = [
  { kind: 'cartridge', label: msg('Cartridges'), href: '/cartridges?src=user' },
  { kind: 'bullet', label: msg('Bullets'), href: '/bullets?src=user' },
  { kind: 'powder', label: msg('Powders'), href: '/powders?src=user' },
  { kind: 'case', label: msg('Brass'), href: '/cases?src=user' },
  { kind: 'targetFaceDesign', label: msg('Targets'), href: '/targets?src=user' },
  { kind: 'firearm', label: msg('Firearms'), href: '/firearms' },
]

/** The notes on firearms and on saved loads, each linked to the page that shows them. */
function noteRows(records: readonly UserRecord[]) {
  const { firearms, loads } = gapCounts(loadGaps(records))
  return [
    { label: msg('Notes on firearms'), href: '/firearms', count: firearms },
    // the Saved loads line of the workbench, opened from Open or the load switcher
    { label: msg('Notes on saved loads'), href: '/workbench', count: loads },
  ]
}

/**
 * One row per kind of {@link yourDataKinds} with the number of `records` of that kind (0 for none).
 * The firearms row adds the notes on firearms and on saved loads (`notes`).
 */
export const yourDataRows = (records: readonly UserRecord[]) =>
  yourDataKinds.map((k) => ({
    ...k,
    count: records.filter((r) => r.kind === k.kind).length,
    ...(k.kind === 'firearm' && { notes: noteRows(records) }),
  }))
