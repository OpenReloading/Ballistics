import type { ChronoShot } from '@open-reloading/schema'
import { type ChronoDiagnostic, refuse } from './diagnostics.ts'
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
  return isObj(root) && root['format'] === sessionJsonFormat
}

/** Refuses the member at `path` with `code`. */
function fail(path: string, code: ChronoDiagnostic['code']): never {
  refuse(code, { path })
}

/** A finite positive number of the object member `key`, or undefined when absent. */
function positive(o: Obj, key: string, path: string): number | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)
    fail(`${path}.${key}`, 'memberNotPositive')
  return v
}

/** The object member `key` as non-empty text, or undefined when absent; `path` names it in a refusal. */
function optionalText(o: Obj, key: string, path: string): string | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (typeof v !== 'string' || v === '') fail(path, 'memberNotText')
  return v
}

const isDeviceKind = (x: unknown): x is (typeof deviceKinds)[number] =>
  deviceKinds.some((k) => k === x)

/** The `device` member: kind (default `other`), manufacturer name and model as non-empty text when present. */
function readDevice(root: Obj): SessionCandidate['device'] {
  const dev = root['device'] === undefined ? {} : root['device']
  if (!isObj(dev)) fail('device', 'memberNotObject')
  const kind = dev['kind'] === undefined ? 'other' : dev['kind']
  if (!isDeviceKind(kind)) refuse('memberNotDeviceKind', { path: 'device.kind', kinds: deviceKinds })
  return {
    kind,
    manufacturerName: optionalText(dev, 'manufacturerName', 'device.manufacturerName'),
    model: optionalText(dev, 'model', 'device.model'),
  }
}

/** One shot at the member path `p`: velocity in m/s required, `coldBore` and `excluded` optional. */
function readShot(shot: unknown, p: string): ChronoShot {
  if (!isObj(shot)) fail(p, 'memberNotObject')
  const v = positive(shot, 'velocity', p)
  if (v === undefined) fail(`${p}.velocity`, 'velocityRequired')
  const out: ChronoShot = { velocity: { value: v, raw: `${v} m/s` } }
  if (shot['coldBore'] !== undefined) {
    if (typeof shot['coldBore'] !== 'boolean') fail(`${p}.coldBore`, 'memberNotBoolean')
    if (shot['coldBore']) out.coldBore = true
  }
  if (shot['excluded'] !== undefined) {
    if (typeof shot['excluded'] !== 'string' || shot['excluded'] === '')
      fail(`${p}.excluded`, 'excludedNotText')
    out.excluded = shot['excluded']
  }
  return out
}

/** The `strings` member, at least one string of at least one shot each, and a label per string. */
function readStrings(root: Obj): {
  strings: { shots: ChronoShot[] }[]
  labels: (string | undefined)[]
} {
  if (!Array.isArray(root['strings']) || root['strings'].length === 0)
    fail('strings', 'noStrings')
  const labels: (string | undefined)[] = []
  const strings = (root['strings'] as unknown[]).map((s, i) => {
    const at = `strings[${i}]`
    if (!isObj(s)) fail(at, 'memberNotObject')
    if (s['label'] !== undefined && typeof s['label'] !== 'string')
      fail(`${at}.label`, 'memberNotText')
    labels.push(s['label'] || undefined)
    if (!Array.isArray(s['shots']) || s['shots'].length === 0)
      fail(`${at}.shots`, 'noStringShots')
    const shots = (s['shots'] as unknown[]).map((raw, j) => readShot(raw, `${at}.shots[${j}]`))
    return { shots }
  })
  return { strings, labels }
}

/** The `date` member as `YYYY-MM-DD`, or undefined when absent. */
function readDate(root: Obj): string | undefined {
  if (root['date'] === undefined) return undefined
  const date = typeof root['date'] === 'string' ? yearFirstDate(root['date']) : undefined
  if (!date) fail('date', 'memberNotDate')
  return date
}

/**
 * An OpenReloading session JSON file, the format the session summary exports. Velocities are m/s.
 * The muzzle distance is m in the file and mm (the stored unit) in the session.
 *
 * ```
 * { "format": "openreloading-session", "version": 1, "date"?, "device"?: { "kind", "manufacturerName"?, "model"? },
 *   "muzzleDistance"? (m), "note"?, "strings": [{ "label"?, "shots": [{ "velocity" (m/s), "coldBore"?, "excluded"? }] }] }
 * ```
 */
export function parseOpenReloadingJson(
  text: string,
  options: ChronoParserOptions = {},
): ChronoImport {
  const root = parse(text)
  if (!isObj(root) || root['format'] !== sessionJsonFormat)
    refuse('notSessionJson', { format: sessionJsonFormat })
  if (root['version'] !== 1) refuse('versionUnsupported', { version: String(root['version']) })
  const warnings: ChronoDiagnostic[] = []
  const date = readDate(root)
  const device = readDevice(root)
  const distance = positive(root, 'muzzleDistance', '')
  const note = optionalText(root, 'note', 'note')
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
      ...(note === undefined ? {} : { note }),
    },
    { labels, warnings },
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
