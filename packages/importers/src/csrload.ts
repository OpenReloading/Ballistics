// The load files of ChamberSim Reloaded (`.csrload`, XML) as record candidates. The load input has the
// layout of a GRT load file, read by `readLoadInput`; this file adds the format check and the
// measurement series. The mapping and its reasons: `apps/docs/docs/data/grt-load-files.md`. It was
// written from saved files of format 1.

import type { SessionRecord } from '@open-reloading/schema'
import type { Candidate } from './diagnostics.ts'
import {
  clip,
  elements,
  type GrtLoadRead,
  type LoadDiagnostic,
  named,
  numberOf,
  readLoadInput,
  unescaped,
} from './grtload.ts'
import { idOfKey } from './record-ids.ts'
import { parseXml, type XmlElement } from './xml.ts'

/** The root element of the file, which tells it apart from other XML. */
const csrLoadRoot = 'ChamberSimReloaded'
/** The `format` attribute of the root the reader was written for. */
const csrFormat = '1'
/** The most shots of a string and strings of a session the session schema takes. */
const maxShots = 5000
const maxStrings = 500

/** The attributes of the measurement elements that are read; the others are listed when they hold a value. */
const readAttributes: Record<string, string[]> = {
  Measurement: [],
  charge: ['name', 'note', 'value'],
  shot: ['velocity'],
}

/** An attribute value that holds nothing: empty, an unmeasured pressure, empty source options. */
const holdsNothing = (name: string, value: string) =>
  value === '' || (name === 'pressure' && Number(value) === 0) || value === '%7B%7D'

type ShotString = SessionRecord['data']['strings'][number]

/** The attributes of `e` that hold a value and are not read, as `at.name`, into `unmapped`. */
function unreadAttributes(e: XmlElement, at: string, unmapped: Set<string>) {
  for (const [name, value] of Object.entries(e.attributes))
    if (!readAttributes[e.name]?.includes(name) && !holdsNothing(name, value.trim()))
      unmapped.add(`${at}.${name}`)
}

/** The shots of a charge with a velocity above 0, in m/s; each other shot gives a warning. */
function shotsOf(c: XmlElement, at: string, unmapped: Set<string>, warnings: LoadDiagnostic[]) {
  const shots: ShotString['shots'] = []
  for (const s of elements(c)) {
    if (s.name !== 'shot') {
      unmapped.add(`${at}.${s.name}`)
      continue
    }
    unreadAttributes(s, `${at}.shot`, unmapped)
    const v = numberOf((s.attributes['velocity'] ?? '').trim())
    if (Number.isFinite(v) && v > 0) shots.push({ velocity: { value: v } })
    else warnings.push({ code: 'shotWithoutVelocity', params: { at } })
  }
  return shots
}

/**
 * One charge of a series as a shot string: velocities in m/s, the charge from kg to g. Undefined,
 * with a warning, when no shot has a velocity.
 */
function stringOf(
  c: XmlElement,
  at: string,
  unmapped: Set<string>,
  warnings: LoadDiagnostic[],
): ShotString | undefined {
  unreadAttributes(c, at, unmapped)
  const shots = shotsOf(c, at, unmapped, warnings)
  const label = clip(unescaped(c.attributes['name'] ?? '', `${at}.name`, warnings))
  const labelText = label ?? ''
  if (shots.length === 0) {
    warnings.push({ code: 'chargeWithoutShots', params: { at, label: labelText } })
    return undefined
  }
  const note = clip(unescaped(c.attributes['note'] ?? '', `${at}.note`, warnings), 2000)
  const grams = chargeGrams(c)
  const string: ShotString = {
    ...(label && { label }),
    ...(note && { note }),
    shots: shots.slice(0, maxShots),
  }
  if (shots.length > maxShots)
    warnings.push({
      code: 'shotsBeyondLimit',
      params: { at, count: shots.length - maxShots, label: labelText, max: maxShots },
    })
  if (grams === undefined)
    warnings.push({ code: 'chargeWithoutMass', params: { at, label: labelText } })
  else string.variation = { kind: 'charge', value: { value: grams } }
  return string
}

/** The mass of a charge in g from its `value` in kg, or undefined when that is not above 0. */
function chargeGrams(c: XmlElement): number | undefined {
  const kg = numberOf((c.attributes['value'] ?? '').trim())
  return Number.isFinite(kg) && kg > 0 ? Number((kg * 1000).toPrecision(12)) : undefined
}

/** Each measurement series of the appendix as a session candidate whose strings name the load. */
function sessionsOf(
  appendix: XmlElement | undefined,
  load: Candidate,
  { unmapped, warnings }: { unmapped: Set<string>; warnings: LoadDiagnostic[] },
): Candidate[] {
  const sessions: Candidate[] = []
  const seen = new Map<string, number>()
  for (const m of appendix ? elements(appendix).filter((e) => e.name === 'Measurement') : []) {
    const at = 'appendix.Measurement'
    unreadAttributes(m, at, unmapped)
    const strings = elements(m).flatMap((c) => {
      if (c.name === 'charge') return stringOf(c, `${at}.charge`, unmapped, warnings) ?? []
      unmapped.add(`${at}.${c.name}`)
      return []
    })
    if (strings.length === 0) continue
    const left = strings.slice(maxStrings)
    if (left.length > 0)
      warnings.push({
        code: 'chargesBeyondLimit',
        params: {
          at,
          count: left.length,
          shots: left.reduce((n, s) => n + s.shots.length, 0),
          max: maxStrings,
        },
      })
    const data = {
      origin: 'user' as const,
      device: { kind: 'other' as const },
      strings: strings
        .slice(0, maxStrings)
        .map((s) => ({ load: `user:${idOfKey(load.key)}` as const, ...s })),
      provenance: {
        kind: 'measured' as const,
        sources: [{ title: 'Measurements of a ChamberSim Reloaded load file' }],
      },
    }
    // The first series of a content keeps the plain key; a repeat adds its count, so ids stay apart.
    const content = JSON.stringify(data)
    const repeat = seen.get(content) ?? 0
    seen.set(content, repeat + 1)
    const key = repeat === 0 ? 'session' : `session|${repeat}`
    sessions.push({ kind: 'session', ...named(key, load.name, data) })
  }
  return sessions
}

/**
 * The record candidates of a ChamberSim Reloaded load file: those of `readGrtLoad` (the cartridge,
 * the bullet after its maker, the powder and the load), then a session for each measurement series
 * whose strings name the load. A series maps per charge to a string of shot velocities (m/s) that varies
 * the charge; shot pressures, the display settings and every other part are listed as not read.
 * A format other than 1 gives a warning. Ids come from the content (a repeated series of the same
 * content also from its count), so a file read again gives the same ids. Throws with the reason
 * on a file that is no load file of this format. The caller makes each candidate a record and
 * checks it with the user record schema.
 */
export function readCsrLoad(xml: string): GrtLoadRead {
  const root = parseXml(xml.replace(/^﻿/, ''))
  if (root.name !== csrLoadRoot) throw new Error(`The root element is not ${csrLoadRoot}.`)
  const input = elements(root).find((e) => e.name === 'load')
  if (!input) throw new Error('The file holds no load.')
  const read = readLoadInput(input)
  const format = root.attributes['format']
  const formatWarning: LoadDiagnostic = format
    ? { code: 'otherFormat', params: { format: format.slice(0, 20), expected: csrFormat } }
    : { code: 'unknownFormat', params: { expected: csrFormat } }
  const warnings = format === csrFormat ? read.warnings : [formatWarning, ...read.warnings]
  const unmapped = new Set(read.unmapped.filter((u) => u !== 'appendix.Measurement'))
  const load = read.candidates.at(-1)
  const appendix = elements(input).find((e) => e.name === 'appendix')
  const sessions = load ? sessionsOf(appendix, load, { unmapped, warnings }) : []
  return { candidates: [...read.candidates, ...sessions], unmapped: [...unmapped], warnings }
}
