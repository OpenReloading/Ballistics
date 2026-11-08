import { parseRef, type UserRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'

/** A saved load whose cartridge differs from the cartridge of the firearm it names. */
type Mismatch = { load: string; cartridge: string }

/** `own` is the firearm's cartridge where it differs. */
type LoadGap = { kind: 'none' | 'missing' } | { kind: 'mismatch'; cartridge: string; own: string }

/** Compared by reference, both set; `designs` names the user's cartridge designs by reference. */
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

/** The firearm library counts unused firearms and mismatches; the Saved loads line each load with a gap. */
export const gapCounts = ({ unused, mismatches, loads }: ReturnType<typeof loadGaps>) => ({
  firearms: [...mismatches.values()].reduce((n, m) => n + m.length, unused.size),
  loads: loads.size,
})

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
