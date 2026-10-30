import { parseRef, type UserRecord } from '@open-reloading/schema'
import { fetchRecord } from './api-fetch.ts'
import { toCsv } from './csv.ts'
import { localDay } from './dates.ts'
import { download } from './download.ts'
import { type FirearmUse, loadUse } from './load-use.ts'
import { storedRecords } from './user-store.ts'

type FirearmRecord = Extract<UserRecord, { kind: 'firearm' }>
/** The API path of each kind of record a load names. */
type Kind = 'cartridges' | 'firearms' | 'bullets' | 'powders'
/** The name of the record `ref` names, else the reference as stored; empty without a reference. */
type NameOf = (kind: Kind, ref: string | undefined) => string

/**
 * Header and one row per saved load in stored units: charge in g, seating length in mm, the last
 * session as YYYY-MM-DD.
 */
export function loadRows(records: readonly UserRecord[], nameOf: NameOf): (string | number)[][] {
  const { loads } = loadUse(records)
  return [
    [
      'Name',
      'Cartridge',
      'Firearm',
      'Bullet',
      'Powder',
      'Charge (g)',
      'Seating (mm)',
      'Seated by',
      'Sessions',
      'Last session',
    ],
    ...records.flatMap((r) => {
      if (r.kind !== 'load') return []
      const d = r.data
      const use = loads.get(r.id)
      return [
        [
          r.name,
          nameOf('cartridges', d.cartridge),
          nameOf('firearms', d.firearm),
          typeof d.bullet === 'object' ? d.bullet.model : nameOf('bullets', d.bullet),
          typeof d.powder === 'object' ? d.powder.name : nameOf('powders', d.powder),
          d.charge?.value ?? '',
          d.seating?.value.value ?? '',
          d.seating?.by ?? '',
          use?.sessions ?? 0,
          use?.last ?? '',
        ],
      ]
    }),
  ]
}

/** Header and one row per firearm: name, cartridge, round count, saved loads and last session day. */
export function firearmRows(
  firearms: readonly FirearmRecord[],
  uses: ReadonlyMap<string, FirearmUse>,
  cartridgeName: (ref: string | undefined) => string | undefined,
): (string | number)[][] {
  return [
    ['Name', 'Cartridge', 'Round count', 'Loads', 'Last session'],
    ...firearms.map((r) => [
      r.name,
      cartridgeName(r.data.cartridge) ?? '',
      r.data.roundCount ?? '',
      uses.get(r.id)?.loads ?? 0,
      uses.get(r.id)?.last ?? '',
    ]),
  ]
}

/** The names of the records the loads name: from this browser's records, else asked from the API once each. */
async function recordNames(records: readonly UserRecord[]): Promise<NameOf> {
  const own = new Map(records.map((r) => [r.id, r.name]))
  const refs = new Map<string, [Kind, string]>()
  for (const r of records) {
    if (r.kind !== 'load') continue
    for (const [kind, ref] of [
      ['cartridges', r.data.cartridge],
      ['firearms', r.data.firearm],
      ['bullets', r.data.bullet],
      ['powders', r.data.powder],
    ] as const)
      if (typeof ref === 'string') refs.set(`${kind} ${ref}`, [kind, ref])
  }
  const names = new Map(
    await Promise.all(
      [...refs].map(async ([key, [kind, ref]]) => {
        const target = parseRef(ref)
        const name =
          target?.scope === 'user'
            ? own.get(target.id)
            : target &&
              (await fetchRecord<{ name?: string }>(kind, target.id).catch(() => undefined))?.name
        return [key, name ?? ref] as const
      }),
    ),
  )
  return (kind, ref) => (ref === undefined ? '' : (names.get(`${kind} ${ref}`) ?? ref))
}

/** Saves `rows` as `openreloading-<what>-<day>.csv`, written in the browser. No notice: a download carries the data only. */
const save = (rows: (string | number)[][], what: string) =>
  download(
    new Blob(['﻿', `${toCsv(rows)}\n`], { type: 'text/csv;charset=utf-8' }),
    `openreloading-${what}-${localDay(new Date())}.csv`,
  )

/** Saves the saved loads of this browser as CSV. */
export async function saveLoadsCsv() {
  const { records } = await storedRecords()
  save(loadRows(records, await recordNames(records)), 'loads')
}

/** Saves the firearm list as CSV. */
export const saveFirearmsCsv = (...args: Parameters<typeof firearmRows>) =>
  save(firearmRows(...args), 'firearms')
