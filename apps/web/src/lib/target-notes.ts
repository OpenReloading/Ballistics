/**
 * Notes on a target sheet: placeholders `{key.unit}`
 * that show a group's values, resolved on every render. No React, DOM or Next.js.
 */
import type { GroupStatistics } from '@open-reloading/core'
import type { ShotGroup } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { readoutRows, readouts } from './group-readouts.ts'
import { groupStatisticsOf } from './target-groups.ts'
import { type UnitSystem, unitsOf, withUnit } from './units.ts'

type Unit = 'length' | 'moa' | 'mrad'
const unitNames: Record<Unit, (s: UnitSystem) => string> = {
  length: (s) => s.length.symbol,
  moa: () => 'MOA',
  mrad: () => 'mrad',
}

/** The picker's rows: a value and its tokens, one per unit for a readout. */
export const notePlaceholders: {
  label: string
  help: string
  tokens: { token: string; unit?: Unit | undefined }[]
}[] = [
  { label: 'Group name', help: 'The name of the group.', tokens: [{ token: '{name}' }] },
  { label: 'Shots', help: 'Shots in the statistics.', tokens: [{ token: '{shots}' }] },
  { label: 'Excluded', help: 'Excluded shots.', tokens: [{ token: '{excluded}' }] },
  { label: 'Distance', help: 'Muzzle to target.', tokens: [{ token: '{distance}' }] },
  ...readoutRows.map(([key, label, help]) => ({
    label,
    help,
    tokens: (['length', 'moa', 'mrad'] as const).map((unit) => ({
      token: `{${key}.${unit}}`,
      unit,
    })),
  })),
]

/** A unit's name in the picker: the display length unit, MOA or mrad. */
export const readoutUnitName = (u: Unit, system: UnitSystem) => unitNames[u](system)

const readoutKeys = new Set<string>(readoutRows.map(([key]) => key))
const plain = new Set(['name', 'shots', 'excluded', 'distance'])

/**
 * `text` with each known placeholder replaced by the value of `group` now; "n/a" for a value the
 * statistics leave out or without the group; other text, unknown tokens included, as typed.
 */
export function resolveNote(
  text: string,
  group: ShotGroup | undefined,
  system: UnitSystem,
  stats: GroupStatistics | undefined = group && groupStatisticsOf(group),
): string {
  if (!text.includes('{')) return text
  const rows = group && stats ? readouts(stats, group.distance) : []
  return text.replace(/\{([A-Za-z]+)(?:\.([a-z]+))?\}/g, (token, key: string, unit?: string) =>
    unit === undefined && plain.has(key)
      ? plainValue(key, group, stats, system)
      : readoutValue(token, key, unit, rows, system),
  )
}

function plainValue(
  key: string,
  group: ShotGroup | undefined,
  stats: GroupStatistics | undefined,
  system: UnitSystem,
): string {
  if (!group || !stats) return 'n/a'
  if (key === 'name') return group.name
  if (key === 'shots') return String(stats.shotCount)
  if (key === 'excluded') return String(stats.excludedCount)
  return withUnit('range', system, group.distance)
}

function readoutValue(
  token: string,
  key: string,
  unit: string | undefined,
  rows: ReturnType<typeof readouts>,
  system: UnitSystem,
): string {
  if (!readoutKeys.has(key) || !(unit === 'length' || unit === 'moa' || unit === 'mrad'))
    return token
  const r = rows.find((x) => x.key === key)
  if (!r) return 'n/a'
  if (unit === 'length') return withUnit('length', system, r.value)
  const u = unit === 'moa' ? unitsOf.correction.MOA : unitsOf.correction.mrad
  return `${formatNumber(u.fromSi(r.angle), u.decimals)} ${u.symbol}`
}
