import { baseDimensionKeys, baseTypeKey } from '../lib/bullet.ts'
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
  /** The keys of the typed sheet and powder values (`specFields`). */
  specKeys: ReadonlySet<string>
  /** The base form typed over the record's own. */
  baseChanged: boolean
  setField: (key: string, value: FieldValue) => void
  clearError: (key: string) => void
  unsetTypedBullet: (keys: readonly string[]) => void
  unsetTypedSpec: (keys: readonly string[]) => void
  follow: (keys: readonly FollowKey[]) => void
  setGunWeight: (value: FieldValue) => void
}

/** Writes the record's value `si` into the field `key`, or the gun weight. */
function writeRecordValue(key: string, si: number, a: ResetTargets) {
  if (key === 'firearmMass') {
    a.setGunWeight({ text: fixedFieldText('firearmMass', a.system, si), si })
    return
  }
  const quantity = interiorFields.find((s) => s.key === key)?.quantity
  if (!quantity) return
  a.setField(key, { text: fixedFieldText(quantity, a.system, si), si })
  a.clearError(key)
}

/**
 * Gives the changed values among `keys` the record's value again, the way each came to differ:
 * a typed Bullet card, cartridge sheet or powder value is dropped (the field then shows the
 * record's), a followed field follows its default again, the others are written with the record's
 * value as a record fills them. Returns how many it reset.
 */
export function resetToRecord(keys: readonly string[], a: ResetTargets) {
  const reset = keys.filter((k) => a.changes[k] !== undefined)
  const typed = reset.filter((k) => a.bulletKeys.has(k))
  const specs = reset.filter((k) => a.specKeys.has(k))
  // the base form takes the dimensions typed for it along: they describe the form that goes
  const form = a.baseChanged && keys.includes(baseTypeKey)
  const dropped = form ? [baseTypeKey, ...baseDimensionKeys, ...typed] : typed
  if (dropped.length > 0) a.unsetTypedBullet(dropped)
  if (specs.length > 0) a.unsetTypedSpec(specs)
  const followed = reset.filter(isFollowKey)
  for (const key of followed) a.setField(key, { text: '', si: undefined })
  if (followed.length > 0) a.follow(followed)
  for (const key of reset) {
    const si = a.changes[key]
    if (si === undefined || typed.includes(key) || specs.includes(key) || isFollowKey(key)) continue
    writeRecordValue(key, si, a)
  }
  return reset.length + (form ? 1 : 0)
}
