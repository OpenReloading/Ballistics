/**
 * Default shot-start pressure of M3 (`apps/docs/docs/models/interior-m3.md`, "Shot start") when the load gives
 * none. Approximate: effective values of the load-table fit, not measurements of a bullet.
 */
import { need } from '../errors.ts'

/** A default shot-start pressure with its interval and source. */
export interface StartPressureDefault {
  /** Shot-start pressure, Pa. */
  value: number
  /** 95 % interval, Pa; absent for an assumption. */
  interval?: [number, number]
  approximate: true
  source: string
}

/** Bullet construction read from the bullet type: cast or coated lead, plated, jacketed, solid. */
export type BulletConstruction = 'lead' | 'plated' | 'jacketed' | 'monolithic'

/** Barrel length below which a load counts as a handgun load, m. */
export const handgunBarrelLengthLimit = 0.3

const rifle: StartPressureDefault = {
  value: 30e6,
  approximate: true,
  source:
    'assumption, not fitted (apps/docs/docs/models/interior-m3.md, "Shot start"): the value before the study; on the rifle validation rows of the load-table fit the fitted rules (one value, by construction, by construction and class) stayed within 0.1 percentage points of it',
}

const handgunSource =
  'fitted to the handgun training rows of this construction in the load-table fit (one value per construction and class; apps/docs/docs/models/interior-m3.md, "Shot start"); interval: cartridge bootstrap with the powder parameters held, a lower bound'

const handgun = (value: number, low: number, high: number): StartPressureDefault => ({
  value: value * 1e6,
  interval: [low * 1e6, high * 1e6],
  approximate: true,
  source: handgunSource,
})

const handguns: Record<BulletConstruction, StartPressureDefault> = {
  jacketed: handgun(30.8, 21.2, 40.6),
  lead: handgun(24.3, 16.7, 34.2),
  plated: handgun(30.9, 13.2, 37.7),
  monolithic: handgun(50.0, 33.8, 65.3),
}

/**
 * Default start pressure for a barrel length in m and the bullet construction: the rifle assumption
 * at `handgunBarrelLengthLimit` and longer (the construction does not enter), the fitted value of the
 * construction below; jacketed when the construction is not known. Throws `InputError` for a barrel
 * that is not a positive number.
 */
export function defaultStartPressure(
  barrel: number,
  construction: BulletConstruction = 'jacketed',
): StartPressureDefault {
  need(Number.isFinite(barrel) && barrel > 0, `barrel ${barrel} m must be a positive number`)
  need(Object.hasOwn(handguns, construction), `unknown bullet construction ${construction}`)
  return barrel < handgunBarrelLengthLimit ? handguns[construction] : rifle
}
