import {
  type ChronoFormatId,
  type ChronoImport,
  type ChronoParserOptions,
  chronoFormats,
  decodeText,
  isWorkbook,
  parseChrono,
  readWorkbook,
  stringifyOpenReloadingJson,
  type VelocityUnit,
} from '@openreloading/importers'

import { toCsv } from './csv.ts'
import { formatNumber, type Unit } from './units.ts'

export type Shot = ChronoImport['session']['strings'][number]['shots'][number]

export const formatNames = Object.fromEntries(chronoFormats.map((f) => [f.id, f.name])) as Record<
  ChronoFormatId,
  string
>

/** The OpenReloading JSON template: the members the importer reads (velocities in m/s) and two made-up strings. */
export const templateJson = `${JSON.stringify(
  {
    format: 'openreloading-session',
    version: 1,
    date: '2026-03-05',
    device: { kind: 'other', manufacturerName: 'Manufacturer', model: 'Model' },
    strings: [
      {
        label: 'A',
        shots: [
          { velocity: 852, coldBore: true },
          { velocity: 856 },
          { velocity: 854, excluded: 'flyer' },
        ],
      },
      { label: 'B', shots: [{ velocity: 863 }] },
    ],
  },
  null,
  2,
)}\n`

/** The OpenReloading CSV template: the column names the importer reads and two made-up strings. */
export const templateCsv = `${[
  'string,velocity,velocityUnit,coldBore,excluded',
  'A,2795,fps,yes,',
  'A,2810,fps,,',
  'A,2803,fps,,flyer',
  'B,2831,fps,,',
].join('\n')}\n`

/** File name of the example session download. */
export const exampleSessionFileName = 'openreloading-example-session.csv'

const exampleShots: [string, number[]][] = [
  ['Example A', [2794, 2801, 2788, 2810, 2797, 2805, 2792, 2799, 2803, 2796]],
  ['Example B', [2831, 2824, 2838, 2829, 2835, 2827, 2840, 2833, 2826, 2832]],
  ['Example C', [2862, 2855, 2869, 2858, 2871, 2864, 2860, 2866, 2884, 2859]],
]

/** The example session of the session summary: three strings of ten made-up shots, labelled as an example. */
export const exampleCsv = `${[
  'string,velocity,velocityUnit,coldBore,excluded',
  ...exampleShots.flatMap(([label, shots]) =>
    shots.map(
      (v, k) =>
        `${label},${v},fps,${label === 'Example A' && k === 0 ? 'yes' : ''},${label === 'Example C' && k === 8 ? 'flyer' : ''}`,
    ),
  ),
].join('\n')}\n`

/** Largest file read, bytes: 32 MiB, the importers' limit for the unpacked parts of a workbook. */
const maxFileBytes = 32 * 1024 * 1024
const tooLarge = 'The file is larger than 32 MiB.'

/** The bytes of a chosen file, its size checked before reading, so a large file chosen by mistake is never loaded. */
export async function chronoFileBytes(file: Blob) {
  if (file.size > maxFileBytes) throw new Error(tooLarge)
  return new Uint8Array(await file.arrayBuffer())
}

/** A chronograph export told by its content and parsed in the caller's process; nothing is sent. */
export async function readChrono(
  bytes: Uint8Array,
  options: ChronoParserOptions,
): Promise<ChronoImport> {
  if (isWorkbook(bytes)) {
    const result = parseChrono(await readWorkbook(bytes), options)
    if (result) return result
    throw new Error('The workbook is not a recognized chronograph export.')
  }
  if (bytes.length > maxFileBytes) throw new Error(tooLarge)
  const text = decodeText(bytes)
  const result = parseChrono(text, options)
  if (result) return result
  throw new Error('The file is not a recognized chronograph export.')
}

/**
 * A file of the session summary: read with the unit the file names, and with `fallback` only when
 * the file names none (or one the importers do not know).
 */
export async function readSession(
  bytes: Uint8Array,
  fileName: string,
  fallback: VelocityUnit,
): Promise<ChronoImport> {
  try {
    return await readChrono(bytes, { fileName })
  } catch (first) {
    try {
      return await readChrono(bytes, { fileName, velocityUnit: fallback })
    } catch (second) {
      // the file names its unit, so the first reason is the one that counts
      throw second instanceof Error && second.message.includes('named by the caller')
        ? first
        : second
    }
  }
}

/** Label "String n" or "String n: label" for the string at zero-based index `k`. */
export const stringName = (labels: (string | undefined)[], k: number) =>
  `String ${k + 1}${labels[k] ? `: ${labels[k]}` : ''}`

/** Header and one row per string: shots, excluded, mean, SD, ES, min and max in `unit` with 1 decimal. */
function statisticsRows(data: ChronoImport, unit: Unit): (string | number)[][] {
  const v = (ms: number | undefined) => (ms === undefined ? '' : formatNumber(unit.fromSi(ms), 1))
  const u = ` (${unit.symbol})`
  return [
    ['String', 'Shots', 'Excluded', ...['Mean', 'SD', 'ES', 'Min', 'Max'].map((h) => h + u)],
    ...data.session.strings.map((s, k) => {
      const st = stringStats(s.shots)
      return [
        stringName(data.stringLabels, k),
        st?.count ?? 0,
        st?.excluded ?? s.shots.length,
        v(st?.mean),
        v(st?.standardDeviation),
        v(st?.extremeSpread),
        v(st?.min),
        v(st?.max),
      ]
    }),
  ]
}

/** Header and one row per shot: string, number, velocity in `unit` with 1 decimal, cold bore, exclusion. */
function shotRows(data: ChronoImport, unit: Unit): (string | number)[][] {
  const v = (ms: number | undefined) => (ms === undefined ? '' : formatNumber(unit.fromSi(ms), 1))
  return [
    ['String', 'Shot', `Velocity (${unit.symbol})`, 'Cold bore', 'Excluded'],
    ...data.session.strings.flatMap((s, k) =>
      s.shots.map((shot, n) => [
        stringName(data.stringLabels, k),
        n + 1,
        v(shot.velocity.value),
        shot.coldBore ? 'yes' : '',
        shot.excluded ?? '',
      ]),
    ),
  ]
}

/**
 * The session summary as CSV: the statistics per string, an empty line, then every shot, velocities
 * in `unit` with 1 decimal. No notice: a download carries the data only.
 */
export function sessionCsv(data: ChronoImport, unit: Unit): string {
  return `${toCsv(statisticsRows(data, unit))}\n\n${toCsv(shotRows(data, unit))}\n`
}

/** The JSON download: the session as OpenReloading session JSON, velocities in m/s. */
export const sessionJsonBlob = (data: ChronoImport) =>
  new Blob([stringifyOpenReloadingJson(data)], { type: 'application/json' })

/** The CSV download: UTF-8 with a byte order mark, which spreadsheets need to read non-ASCII text. */
export const sessionCsvBlob = (data: ChronoImport, unit: Unit) =>
  new Blob(['\uFEFF', sessionCsv(data, unit)], { type: 'text/csv;charset=utf-8' })

export interface StringStats {
  /** Shots in the statistics: all but the excluded ones. */
  count: number
  excluded: number
  /** m/s. */
  mean: number
  /** Sample standard deviation (n - 1), m/s; undefined below two shots. */
  standardDeviation: number | undefined
  /** Extreme spread, max - min, m/s. */
  extremeSpread: number
  min: number
  max: number
}

/** Statistics of one string over its shots without an exclusion reason; undefined when none is left. */
export function stringStats(shots: Shot[]): StringStats | undefined {
  const v = shots.filter((s) => !s.excluded).map((s) => s.velocity.value)
  if (v.length === 0) return undefined
  const mean = v.reduce((a, x) => a + x, 0) / v.length
  const sd =
    v.length > 1
      ? Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / (v.length - 1))
      : undefined
  const min = v.reduce((a, x) => Math.min(a, x), v[0])
  const max = v.reduce((a, x) => Math.max(a, x), v[0])
  return {
    count: v.length,
    excluded: shots.length - v.length,
    mean,
    standardDeviation: sd,
    extremeSpread: max - min,
    min,
    max,
  }
}
