import type { UserRecord, UserRecordKind } from '@open-reloading/schema'

/** A row of Settings' Your data: a kind of the user's records and the list that shows them. */
interface YourDataKind {
  /** The user record kind the count reads. */
  kind: UserRecordKind
  label: string
  /** The list route; the Mine filter where the list has Mine rows. */
  href: string
}

/**
 * The kinds of records the user owns, in the order of the Database tabs. There is no row for the
 * disciplines (no user record of that kind). Lists without Mine rows (powders, target faces: their
 * designs open in their designers) open unfiltered.
 */
const yourDataKinds: readonly YourDataKind[] = [
  { kind: 'cartridge', label: 'Cartridges', href: '/cartridges?src=user' },
  { kind: 'bullet', label: 'Bullets', href: '/bullets?src=user' },
  { kind: 'powder', label: 'Powders', href: '/powders' },
  { kind: 'case', label: 'Cases', href: '/cases?src=user' },
  { kind: 'targetFaceDesign', label: 'Targets', href: '/targets' },
  { kind: 'firearm', label: 'Firearms', href: '/firearms' },
]

/** One row per kind of {@link yourDataKinds} with the number of `records` of that kind (0 for none). */
export const yourDataRows = (records: readonly UserRecord[]) =>
  yourDataKinds.map((k) => ({ ...k, count: records.filter((r) => r.kind === k.kind).length }))
