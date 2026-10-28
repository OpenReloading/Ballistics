import type { UserRecord, UserRecordKind } from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'

/** A row of Settings' Your data: a kind of the user's records and the list that shows them. */
interface YourDataKind {
  /** The user record kind the count reads. */
  kind: UserRecordKind
  label: Message
  /** The list route with the Mine filter, or the designer where the list has no Mine rows. */
  href: string
}

/**
 * The kinds of records the user owns, in the order of the Database tabs. There is no row for the
 * disciplines (no user record of that kind). Powders and target faces have no Mine rows in their
 * lists: their rows open the designer, whose File menu lists the browser's records.
 */
const yourDataKinds: readonly YourDataKind[] = [
  { kind: 'cartridge', label: msg('Cartridges'), href: '/cartridges?src=user' },
  { kind: 'bullet', label: msg('Bullets'), href: '/bullets?src=user' },
  { kind: 'powder', label: msg('Powders'), href: '/powders/designer' },
  { kind: 'case', label: msg('Brass'), href: '/cases?src=user' },
  { kind: 'targetFaceDesign', label: msg('Targets'), href: '/targets/designer' },
  { kind: 'firearm', label: msg('Firearms'), href: '/firearms' },
]

/** One row per kind of {@link yourDataKinds} with the number of `records` of that kind (0 for none). */
export const yourDataRows = (records: readonly UserRecord[]) =>
  yourDataKinds.map((k) => ({ ...k, count: records.filter((r) => r.kind === k.kind).length }))
