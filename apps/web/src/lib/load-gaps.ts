import { parseRef, type UserRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'

/** A saved load whose cartridge differs from the cartridge of the firearm it names. */
type Mismatch = { load: string; cartridge: string }

/**
 * The gap of a saved load: it names no firearm, its firearm reference names no stored firearm, or
 * its cartridge differs from its firearm's (`own`).
 */
type LoadGap = { kind: 'none' | 'missing' } | { kind: 'mismatch'; cartridge: string; own: string }

/**
 * The gaps between saved loads and the user's firearms, by firearm id: the loads that name a
 * firearm of another cartridge (compared by reference, both set) and the firearms no load names.
 * By load id (`loads`): the loads without a firearm, those whose firearm reference names no stored
 * firearm (no mismatch) and the mismatches. `designs` names the user's cartridge designs by
 * reference.
 */
export function loadGaps(records: readonly UserRecord[]) {
  const cartridges = new Map(
    records.flatMap((r) => (r.kind === 'firearm' ? [[r.id, r.data.cartridge] as const] : [])),
  )
  const unused = new Set(cartridges.keys())
  const mismatches = new Map<string, Mismatch[]>()
  const loads = new Map<string, LoadGap>()
  for (const r of records) {
    if (r.kind !== 'load') continue
    const target = r.data.firearm === undefined ? undefined : parseRef(r.data.firearm)
    if (target?.scope !== 'user' || !cartridges.has(target.id)) {
      loads.set(r.id, { kind: r.data.firearm === undefined ? 'none' : 'missing' })
      continue
    }
    unused.delete(target.id)
    const own = cartridges.get(target.id)
    const cartridge = r.data.cartridge
    if (own === undefined || cartridge === undefined || cartridge === own) continue
    mismatches.set(target.id, [...(mismatches.get(target.id) ?? []), { load: r.name, cartridge }])
    loads.set(r.id, { kind: 'mismatch', cartridge, own })
  }
  const designs = new Map<string, string>(
    records.flatMap((r) => (r.kind === 'cartridge' ? [[`user:${r.id}`, r.name]] : [])),
  )
  return { unused, mismatches, loads, designs }
}

/** The number of gaps, each once: the firearms no load names and the loads with a gap. */
export const gapCount = ({ unused, loads }: ReturnType<typeof loadGaps>) => unused.size + loads.size

/** The note of a saved load's gap, a mismatch naming its `firearm` and both cartridges by `name`. */
export const loadGapNote = (
  gap: LoadGap | undefined,
  firearm: string | undefined,
  name: (ref: string | undefined) => string | undefined,
  t: Translator['t'],
) =>
  gap?.kind === 'mismatch'
    ? t('{name} is for {own}, this load for {other}.', {
        name: firearm ?? '',
        own: name(gap.own) ?? gap.own,
        other: name(gap.cartridge) ?? gap.cartridge,
      })
    : gap && (gap.kind === 'none' ? t('No firearm') : t('Firearm no longer stored'))

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
