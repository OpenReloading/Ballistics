import type { Translator } from '../i18n/translate.ts'

/**
 * Defaults of the load-defining inputs that have a usable value without the user's own: per
 * field, the chosen firearm's value, else the chosen cartridge record's, else the user's Settings,
 * else a value by cartridge class. All SI.
 */

/** A value with the words that say where it comes from ("Default: <source>."). */
export type Suggestion = {
  si: number
  source: string
  /** The firearm's own value: used as the firearm's, not shown as a default. */
  fromFirearm?: true
  /** The cartridge record's value the firearm's replaces, SI: the mark names it. */
  record?: number | undefined
}

/** The form fields that follow a default until typed; the barrel length is the seating's own field. */
export const followKeys = ['volume', 'boreDiameter', 'boreArea', 'twist'] as const
export type FollowKey = (typeof followKeys)[number]
export const isFollowKey = (key: string): key is FollowKey =>
  (followKeys as readonly string[]).includes(key)
export type Suggestions = Partial<Record<FollowKey | 'barrelLength', Suggestion>>

type CartridgeClass = 'rifle' | 'pistol'

/**
 * Barrel length by cartridge class, m: assumptions without a source (24 in, 4 in), used where
 * neither a firearm nor the Settings default gives one.
 */
export const barrelLengthByClass: Record<CartridgeClass, number> = { rifle: 0.6096, pistol: 0.1016 }

/** The CIP table that holds the pistol and revolver cartridges (table IV); all other tables count as rifle. */
const pistolTable = 'IV'

/** The class of a cartridge from the table of its CIP record; undefined without a record. */
export const cartridgeClass = (table: string | undefined): CartridgeClass | undefined =>
  table === undefined ? undefined : table === pistolTable ? 'pistol' : 'rifle'

export type DefaultSources = {
  /** The chosen firearm (of the firearm library); a twist of 0 is none. Bore and groove diameter: measured. */
  firearm?:
    | {
        name: string
        twist?: number | undefined
        barrelLength?: number | undefined
        boreDiameter?: number | undefined
        grooveDiameter?: number | undefined
      }
    | undefined
  /** The chosen cartridge with its record's values: land diameter F, bore area Q, twist u, case capacity as a volume. */
  cartridge?:
    | {
        name: string
        /** A user design: its values are not CIP values, and it has no class. */
        design?: true | undefined
        class?: CartridgeClass | undefined
        boreDiameter?: number | undefined
        boreArea?: number | undefined
        twist?: number | undefined
        capacity?: Suggestion | undefined
      }
    | undefined
  /** The chosen bullet record. */
  bullet?: { name: string; diameter: number } | undefined
  /** The user's barrel length from Settings. */
  settingsBarrelLength?: number | undefined
}

const positive = (x: number | undefined): x is number => x !== undefined && x > 0

/**
 * Whether the chamber volume of a run is a measured case capacity: one was entered for the
 * cartridge and the volume field still holds a value that capacity gives (its followed default or
 * the seated bullet's), not a typed one. A record's capacity and a typed volume are estimates.
 */
export function volumeMeasured(a: {
  measuredCapacity: number | undefined
  volume: number | undefined
  /** The values the measured capacity gives the field: the followed default, the seated volume. */
  derived: readonly (number | undefined)[]
}): boolean {
  const { volume } = a
  return (
    positive(a.measuredCapacity) &&
    positive(volume) &&
    a.derived.some((v) => positive(v) && Math.abs(v - volume) <= 1e-9 * v)
  )
}

/** The bore diameter's default: the firearm's measured one, else the record's F, else the bullet's diameter. */
function boreDiameterDefault(
  gun: DefaultSources['firearm'],
  cartridge: DefaultSources['cartridge'],
  bullet: DefaultSources['bullet'],
  t: Translator['t'],
): Suggestion | undefined {
  if (positive(gun?.boreDiameter))
    return {
      si: gun.boreDiameter,
      source: t('your firearm {name}', { name: gun.name }),
      fromFirearm: true,
      record: cartridge?.boreDiameter,
    }
  if (positive(cartridge?.boreDiameter))
    return {
      si: cartridge.boreDiameter,
      source: cartridge.design
        ? t('chamber F of the user design {name}', { name: cartridge.name })
        : t('CIP land diameter F of {name}', { name: cartridge.name }),
    }
  if (bullet && positive(bullet.diameter))
    return {
      si: bullet.diameter,
      source: t('diameter of {name}, the bore is smaller', { name: bullet.name }),
    }
  return
}

/** The default of each field from what is chosen, in the order firearm, cartridge record, Settings, class. */
export function suggestDefaults(
  { firearm: gun, cartridge, bullet, settingsBarrelLength }: DefaultSources,
  t: Translator['t'],
): Suggestions {
  const out: Suggestions = {}
  if (cartridge?.capacity) out.volume = cartridge.capacity
  const bore = boreDiameterDefault(gun, cartridge, bullet, t)
  if (bore) out.boreDiameter = bore
  // Q is the area of the record's bore: a measured bore or groove gives the circle of their mean instead
  if (
    positive(cartridge?.boreArea) &&
    !positive(gun?.boreDiameter) &&
    !positive(gun?.grooveDiameter)
  )
    out.boreArea = {
      si: cartridge.boreArea,
      source: t('CIP bore area Q of {name}', { name: cartridge.name }),
    }
  if (positive(gun?.twist))
    out.twist = {
      si: gun.twist,
      source: t('your firearm {name}', { name: gun.name }),
      fromFirearm: true,
      record: cartridge?.twist,
    }
  else if (positive(cartridge?.twist))
    out.twist = {
      si: cartridge.twist,
      source: t('CIP twist u of {name}', { name: cartridge.name }),
    }
  if (positive(gun?.barrelLength))
    out.barrelLength = {
      si: gun.barrelLength,
      source: t('your firearm {name}', { name: gun.name }),
      fromFirearm: true,
    }
  else if (positive(settingsBarrelLength))
    out.barrelLength = { si: settingsBarrelLength, source: t('your default from Settings') }
  else if (cartridge?.class)
    out.barrelLength = {
      si: barrelLengthByClass[cartridge.class],
      source:
        cartridge.class === 'pistol'
          ? t('pistol barrel, assumption, no source')
          : t('rifle barrel, assumption, no source'),
    }
  return out
}
