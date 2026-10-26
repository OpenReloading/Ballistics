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
  fromFirearm?: true | undefined
}

/** The form fields that follow a default until typed; the barrel length is the seating's own field. */
export const followKeys = ['volume', 'boreDiameter', 'boreArea', 'twist'] as const
export type FollowKey = (typeof followKeys)[number]
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
  /** The chosen firearm (of the firearm library); a twist of 0 is none. */
  firearm?:
    | { name: string; twist?: number | undefined; barrelLength?: number | undefined }
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

/** The default of each field from what is chosen, in the order firearm, cartridge record, Settings, class. */
export function suggestDefaults({
  firearm: gun,
  cartridge,
  bullet,
  settingsBarrelLength,
}: DefaultSources): Suggestions {
  const out: Suggestions = {}
  if (cartridge?.capacity) out.volume = cartridge.capacity
  if (positive(cartridge?.boreDiameter))
    out.boreDiameter = {
      si: cartridge.boreDiameter,
      source: cartridge.design
        ? `chamber F of the user design ${cartridge.name}`
        : `CIP land diameter F of ${cartridge.name}`,
    }
  else if (bullet && positive(bullet.diameter))
    out.boreDiameter = {
      si: bullet.diameter,
      source: `diameter of ${bullet.name}, the bore is smaller`,
    }
  if (positive(cartridge?.boreArea))
    out.boreArea = { si: cartridge.boreArea, source: `CIP bore area Q of ${cartridge.name}` }
  if (positive(gun?.twist))
    out.twist = { si: gun.twist, source: `your firearm ${gun.name}`, fromFirearm: true }
  else if (positive(cartridge?.twist))
    out.twist = { si: cartridge.twist, source: `CIP twist u of ${cartridge.name}` }
  if (positive(gun?.barrelLength))
    out.barrelLength = {
      si: gun.barrelLength,
      source: `your firearm ${gun.name}`,
      fromFirearm: true,
    }
  else if (positive(settingsBarrelLength))
    out.barrelLength = { si: settingsBarrelLength, source: 'your default from Settings' }
  else if (cartridge?.class)
    out.barrelLength = {
      si: barrelLengthByClass[cartridge.class],
      source: `${cartridge.class} barrel, assumption, no source`,
    }
  return out
}
