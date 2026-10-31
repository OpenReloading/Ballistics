import type { FieldValue } from '../lib/field-spec.ts'
import { type FollowKey, isFollowKey } from '../lib/input-defaults.ts'
import { interiorFields } from '../lib/interior-input.ts'
import { fixedFieldText, type UnitSystem } from '../lib/units.ts'

/** The state a reset writes to; each setter is the workbench's own, so a reset is an edit. */
export interface ResetTargets {
  /** The values the user changed over a record, and the record's, SI (`changedFromRecord`). */
  changes: Record<string, number>
  system: UnitSystem
  /** The keys of the Bullet card's typed values (`bulletFields`). */
  bulletKeys: ReadonlySet<string>
  setField: (key: string, value: FieldValue) => void
  clearError: (key: string) => void
  unsetTypedBullet: (keys: readonly string[]) => void
  follow: (keys: readonly FollowKey[]) => void
  setGunWeight: (value: FieldValue) => void
}

/**
 * Gives the changed values among `keys` the record's value again, the way each came to differ:
 * a typed Bullet card value is dropped (the field then shows the record's), a followed field
 * follows its default again, the others are written with the record's value as a record fills them.
 * Returns how many it reset.
 */
export function resetToRecord(keys: readonly string[], a: ResetTargets) {
  const reset = keys.filter((k) => a.changes[k] !== undefined)
  const typed = reset.filter((k) => a.bulletKeys.has(k))
  if (typed.length > 0) a.unsetTypedBullet(typed)
  const followed = reset.filter(isFollowKey)
  for (const key of followed) a.setField(key, { text: '', si: undefined })
  if (followed.length > 0) a.follow(followed)
  for (const key of reset) {
    const si = a.changes[key]
    if (si === undefined || typed.includes(key) || isFollowKey(key)) continue
    if (key === 'firearmMass') {
      a.setGunWeight({ text: fixedFieldText('firearmMass', a.system, si), si })
      continue
    }
    const quantity = interiorFields.find((s) => s.key === key)?.quantity
    if (!quantity) continue
    a.setField(key, { text: fixedFieldText(quantity, a.system, si), si })
    a.clearError(key)
  }
  return reset.length
}
