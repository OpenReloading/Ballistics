import type { Translator } from '../i18n/translate.ts'

/** Firearm, else cartridge record, else the Settings, else a value by cartridge class; SI. */

/** A value with the words that say where it comes from ("Default: <source>."). */
export type Suggestion = {
  si: number
  source: string
  /** The firearm's own value: used as the firearm's, not shown as a default. */
  fromFirearm?: true
  /** The cartridge record's value the firearm's replaces, SI: the mark names it. */
  record?: number | undefined
  /** The value rests on an estimate: it is not a measured one. */
  approximate?: true
  /** Relative half-width of the interval of an approximate value, 1: the run's tolerance of it. */
  halfWidth?: number
}

/** The form fields that follow a default until typed; the barrel length is the seating's own field. */
export const followKeys = ['volume', 'boreDiameter', 'boreArea', 'twist', 'startPressure'] as const
export type FollowKey = (typeof followKeys)[number]
export const isFollowKey = (key: string): key is FollowKey =>
  (followKeys as readonly string[]).includes(key)
export type Suggestions = Partial<Record<FollowKey | 'barrelLength', Suggestion>>

type CartridgeClass = 'rifle' | 'pistol'

/** m: assumptions without a source (24 in, 4 in) for when neither a firearm nor the Settings give one. */
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

/** Only an entered capacity the volume field still follows; a record's capacity and a typed volume are estimates. */
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
  const barrelLength = barrelLengthDefault(gun, cartridge, settingsBarrelLength, t)
  if (barrelLength) out.barrelLength = barrelLength
  return out
}

/** The barrel length's default: the firearm's, else the one in Settings, else the class's assumption. */
function barrelLengthDefault(
  gun: DefaultSources['firearm'],
  cartridge: DefaultSources['cartridge'],
  settingsBarrelLength: DefaultSources['settingsBarrelLength'],
  t: Translator['t'],
): Suggestion | undefined {
  if (positive(gun?.barrelLength))
    return {
      si: gun.barrelLength,
      source: t('your firearm {name}', { name: gun.name }),
      fromFirearm: true,
    }
  if (positive(settingsBarrelLength))
    return { si: settingsBarrelLength, source: t('your default from Settings') }
  if (cartridge?.class)
    return {
      si: barrelLengthByClass[cartridge.class],
      source:
        cartridge.class === 'pistol'
          ? t('pistol barrel, assumption, no source')
          : t('rifle barrel, assumption, no source'),
    }
}
