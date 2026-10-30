import { parseRef, type UserRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'

/** A saved load whose cartridge differs from the cartridge of the firearm it names. */
type Mismatch = { load: string; cartridge: string }

/**
 * The gaps between saved loads and the user's firearms, by firearm id: the loads that name a
 * firearm of another cartridge (compared by reference, both set) and the firearms no load names.
 * A load whose firearm reference names no stored firearm is no mismatch. `designs` names the
 * user's cartridge designs by reference.
 */
export function loadGaps(records: readonly UserRecord[]) {
  const cartridges = new Map(
    records.flatMap((r) => (r.kind === 'firearm' ? [[r.id, r.data.cartridge] as const] : [])),
  )
  const unused = new Set(cartridges.keys())
  const mismatches = new Map<string, Mismatch[]>()
  for (const r of records) {
    if (r.kind !== 'load' || r.data.firearm === undefined) continue
    const target = parseRef(r.data.firearm)
    if (target?.scope !== 'user' || !cartridges.has(target.id)) continue
    unused.delete(target.id)
    const own = cartridges.get(target.id)
    const cartridge = r.data.cartridge
    if (own === undefined || cartridge === undefined || cartridge === own) continue
    mismatches.set(target.id, [...(mismatches.get(target.id) ?? []), { load: r.name, cartridge }])
  }
  const designs = new Map<string, string>(
    records.flatMap((r) => (r.kind === 'cartridge' ? [[`user:${r.id}`, r.name]] : [])),
  )
  return { unused, mismatches, designs }
}

/** The notes of a firearm's row, each mismatch naming both cartridges by `name`. */
export const gapNotes = (
  firearm: { id: string; data: { cartridge?: string | undefined } },
  { unused, mismatches }: ReturnType<typeof loadGaps>,
  name: (ref: string | undefined) => string | undefined,
  t: Translator['t'],
) => [
  ...(unused.has(firearm.id) ? [t('No saved load with this firearm.')] : []),
  ...(mismatches.get(firearm.id) ?? []).map((m) =>
    t('{load} is for {other}, this firearm for {own}.', {
      load: m.load,
      other: name(m.cartridge) ?? m.cartridge,
      own: name(firearm.data.cartridge) ?? '',
    }),
  ),
]
