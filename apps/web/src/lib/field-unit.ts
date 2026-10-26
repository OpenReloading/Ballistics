import { type FieldValue, fieldValueFromText } from './field-spec.ts'
import { type Quantity, roundedFieldText, type Unit, type UnitSystem, unitsOf } from './units.ts'

/**
 * A field's own unit, set by its inline switch and held in memory: never stored, and dropped
 * when the page's units change. The units store makes a new `UnitSystem` for each choice, so the
 * system the pick was made under tells whether it is current.
 */
export type UnitPick = {
  id: string
  /** The page units the pick was made under. */
  system: UnitSystem
  /** The text typed in the picked unit and the SI value it gave: shown while the value is unchanged. */
  typed?: { text: string; si: number } | undefined
}

/** The units of a quantity as [id, unit] pairs. */
export const unitList = (q: Quantity) => Object.entries(unitsOf[q] as Record<string, Unit>)

/**
 * `pick` while the page units are still the ones it was made under, else none: kept in state, a pick
 * would come back when the same `UnitSystem` object returns after another one.
 */
export const livePick = (pick: UnitPick | undefined, system: UnitSystem) =>
  pick?.system === system ? pick : undefined

/** `system` with the picked unit of `q` in place; `system` itself while no pick is current. */
export function pickedSystem(
  q: Quantity,
  system: UnitSystem,
  pick: UnitPick | undefined,
): UnitSystem {
  if (pick?.system !== system) return system
  const unit = unitList(q).find(([id]) => id === pick?.id)?.[1]
  return unit ? { ...system, [q]: unit } : system
}

/** The pick of unit `id`; none for the page unit itself. */
export function pickUnit(q: Quantity, system: UnitSystem, id: string): UnitPick | undefined {
  const unit = unitList(q).find(([i]) => i === id)?.[1]
  return unit && unit !== system[q] ? { id, system } : undefined
}

/** The text a field shows in the picked unit `shown`: converted from the value's SI value. */
export function pickedText(
  q: Quantity,
  shown: UnitSystem,
  value: FieldValue,
  pick: UnitPick | undefined,
): string {
  if (value.si === undefined) return value.text
  return pick?.typed?.si === value.si ? pick.typed.text : roundedFieldText(q, shown, value.si)
}

/**
 * Text typed in the picked unit `shown`: the SI value from that unit, the text for the page unit
 * `system` beside it so the form's own checks keep reading its unit.
 */
export function pickedTyped(q: Quantity, system: UnitSystem, shown: UnitSystem, text: string) {
  const v = fieldValueFromText(q, shown, text)
  if (v.si === undefined) return { value: v }
  return {
    value: { text: roundedFieldText(q, system, v.si), si: v.si },
    typed: { text, si: v.si },
  }
}
