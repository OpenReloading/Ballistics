import type { ChronoShot } from '@openreloading/schema'
import {
  buildChronoImport,
  type ChronoImport,
  type ChronoParserOptions,
  type SessionCandidate,
} from './result.ts'
import { yearFirstDate } from './text.ts'

/** Value of the `format` member: `openreloading-session`. */
export const sessionJsonFormat = 'openreloading-session'

const deviceKinds = ['doppler-radar', 'optical', 'magnetic', 'other'] as const

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function parse(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return undefined
  }
}

/** True when the text is JSON whose `format` is `openreloading-session`. */
export function isOpenReloadingJson(text: string): boolean {
  if (
    !text
      .replace(/^\uFEFF/, '')
      .trimStart()
      .startsWith('{')
  )
    return false
  const root = parse(text)
  return isObj(root) && root.format === sessionJsonFormat
}

function fail(path: string, what: string): never {
  throw new Error(`${path}: ${what}`)
}

/** A finite positive number of the object member `key`, or undefined when absent. */
function positive(o: Obj, key: string, path: string): number | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)
    fail(`${path}.${key}`, 'must be a positive number')
  return v as number
}

/** The `device` member: kind (default `other`), manufacturer name and model as non-empty text when present. */
function readDevice(root: Obj): SessionCandidate['device'] {
  const d = root.device === undefined ? {} : root.device
  if (!isObj(d)) fail('device', 'must be an object')
  const dev = d as Obj
  const kind = dev.kind === undefined ? 'other' : dev.kind
  if (!deviceKinds.includes(kind as (typeof deviceKinds)[number]))
    fail('device.kind', `must be one of ${deviceKinds.join(', ')}`)
  for (const key of ['manufacturerName', 'model'])
    if (dev[key] !== undefined && (typeof dev[key] !== 'string' || dev[key] === ''))
      fail(`device.${key}`, 'must be text')
  return {
    kind: kind as (typeof deviceKinds)[number],
    manufacturerName: dev.manufacturerName as string | undefined,
    model: dev.model as string | undefined,
  }
}

/** One shot at the member path `p`: velocity in m/s required, `coldBore` and `excluded` optional. */
function readShot(raw: unknown, p: string): ChronoShot {
  if (!isObj(raw)) fail(p, 'must be an object')
  const shot = raw as Obj
  const v = positive(shot, 'velocity', p)
  if (v === undefined) fail(`${p}.velocity`, 'is required, in m/s')
  const out: ChronoShot = { velocity: { value: v as number, raw: `${v} m/s` } }
  if (shot.coldBore !== undefined) {
    if (typeof shot.coldBore !== 'boolean') fail(`${p}.coldBore`, 'must be true or false')
    if (shot.coldBore) out.coldBore = true
  }
  if (shot.excluded !== undefined) {
    if (typeof shot.excluded !== 'string' || shot.excluded === '')
      fail(`${p}.excluded`, 'must be the reason as text')
    out.excluded = shot.excluded as string
  }
  return out
}

/** The `strings` member, at least one string of at least one shot each, and a label per string. */
function readStrings(root: Obj): {
  strings: { shots: ChronoShot[] }[]
  labels: (string | undefined)[]
} {
  if (!Array.isArray(root.strings) || root.strings.length === 0)
    fail('strings', 'must list at least one string')
  const labels: (string | undefined)[] = []
  const strings = (root.strings as unknown[]).map((s, i) => {
    const at = `strings[${i}]`
    if (!isObj(s)) fail(at, 'must be an object')
    const str = s as Obj
    if (str.label !== undefined && typeof str.label !== 'string')
      fail(`${at}.label`, 'must be text')
    labels.push((str.label as string | undefined) || undefined)
    if (!Array.isArray(str.shots) || str.shots.length === 0)
      fail(`${at}.shots`, 'must list at least one shot')
    const shots = (str.shots as unknown[]).map((raw, j) => readShot(raw, `${at}.shots[${j}]`))
    return { shots }
  })
  return { strings, labels }
}

/**
 * An OpenReloading session JSON file, the format the session summary exports:
 * `{ "format": "openreloading-session", "version": 1, "date"?, "device"?: { "kind",
 * "manufacturerName"?, "model"? }, "muzzleDistance"? (m), "note"?, "strings": [{ "label"?, "shots": [{ "velocity" (m/s),
 * "coldBore"?, "excluded"? }] }] }`. Velocities are m/s, so no unit is needed. The muzzle distance is m
 * in the file and mm (the stored unit) in the session.
 */
export function parseOpenReloadingJson(
  text: string,
  options: ChronoParserOptions = {},
): ChronoImport {
  const root = parse(text)
  if (!isObj(root) || root.format !== sessionJsonFormat)
    throw new Error(
      `not an OpenReloading session JSON file: "format" must be "${sessionJsonFormat}"`,
    )
  if (root.version !== 1)
    throw new Error(`version ${String(root.version)} is not supported; expected 1`)
  const warnings: string[] = []

  let date: string | undefined
  if (root.date !== undefined) {
    date = typeof root.date === 'string' ? yearFirstDate(root.date) : undefined
    if (!date) fail('date', 'must be a date as YYYY-MM-DD')
  }

  const device = readDevice(root)
  const distance = positive(root, 'muzzleDistance', '')
  if (root.note !== undefined && (typeof root.note !== 'string' || root.note === ''))
    fail('note', 'must be text')
  const { strings, labels } = readStrings(root)

  return buildChronoImport(
    'openreloading-json',
    {
      date,
      device,
      ...(distance === undefined
        ? {}
        : { muzzleDistance: { value: distance * 1000, raw: `${distance} m` } }),
      strings,
      ...(root.note === undefined ? {} : { note: root.note as string }),
    },
    labels,
    warnings,
    options,
  )
}

/** The session of an import as OpenReloading session JSON, with the string labels inside the strings. */
export function stringifyOpenReloadingJson(data: ChronoImport): string {
  const { date, device, muzzleDistance, strings, note } = data.session
  return `${JSON.stringify(
    {
      format: sessionJsonFormat,
      version: 1,
      ...(date ? { date } : {}),
      device: {
        kind: device.kind,
        ...(device.manufacturerName ? { manufacturerName: device.manufacturerName } : {}),
        ...(device.model ? { model: device.model } : {}),
      },
      ...(muzzleDistance ? { muzzleDistance: muzzleDistance.value / 1000 } : {}),
      ...(note ? { note } : {}),
      strings: strings.map((s, i) => ({
        ...(data.stringLabels[i] ? { label: data.stringLabels[i] } : {}),
        shots: s.shots.map((shot) => ({
          velocity: shot.velocity.value,
          ...(shot.coldBore ? { coldBore: true } : {}),
          ...(shot.excluded ? { excluded: shot.excluded } : {}),
        })),
      })),
    },
    null,
    2,
  )}\n`
}
