// The load files of ChamberSim Reloaded (`.csrload`, XML) as user records. The load input has the
// layout of a GRT load file, read by `readLoadInput`; this file adds the format check and the
// measurement series. The mapping and its reasons: `apps/docs/docs/data/grt-load-files.md`. It was
// written from saved files of format 1.

import type { SessionRecord, UserRecord } from '@open-reloading/schema'
import {
  clip,
  elements,
  type GrtLoadRead,
  named,
  numberOf,
  readLoadInput,
  unescaped,
} from './grtload.ts'
import { parseXml, type XmlElement } from './xml.ts'

/** The root element of the file, which tells it apart from other XML. */
const csrLoadRoot = 'ChamberSimReloaded'
/** The `format` attribute of the root the reader was written for. */
const csrFormat = '1'

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
function shotsOf(c: XmlElement, at: string, unmapped: Set<string>, warnings: string[]) {
  const shots: ShotString['shots'] = []
  for (const s of elements(c)) {
    if (s.name !== 'shot') {
      unmapped.add(`${at}.${s.name}`)
      continue
    }
    unreadAttributes(s, `${at}.shot`, unmapped)
    const v = numberOf((s.attributes.velocity ?? '').trim())
    if (Number.isFinite(v) && v > 0) shots.push({ velocity: { value: v } })
    else warnings.push(`${at}: a shot without a velocity is not read.`)
  }
  return shots
}

/**
 * One charge of a series as a shot string: velocities in m/s, the charge from kg to g. Undefined,
 * with a warning, when no shot has a velocity.
 */
function stringOf(c: XmlElement, at: string, unmapped: Set<string>, warnings: string[]) {
  unreadAttributes(c, at, unmapped)
  const shots = shotsOf(c, at, unmapped, warnings)
  const label = clip(unescaped(c.attributes.name ?? '', `${at}.name`, warnings))
  if (shots.length === 0) {
    warnings.push(`${at}: the charge ${label ?? ''} holds no shot with a velocity; it is not read.`)
    return
  }
  const note = clip(unescaped(c.attributes.note ?? '', `${at}.note`, warnings), 2000)
  const kg = numberOf((c.attributes.value ?? '').trim())
  const string: ShotString = {
    ...(label && { label }),
    ...(note && { note }),
    shots: shots.slice(0, 5000),
  }
  if (Number.isFinite(kg) && kg > 0)
    string.variation = { kind: 'charge', value: { value: Number((kg * 1000).toPrecision(12)) } }
  else warnings.push(`${at}: the charge ${label ?? ''} has no mass; its string varies nothing.`)
  return string
}

/** Each measurement series of the appendix as a session whose strings name the load. */
function sessionsOf(
  appendix: XmlElement | undefined,
  load: UserRecord,
  saved: string,
  unmapped: Set<string>,
  warnings: string[],
): SessionRecord[] {
  const sessions: SessionRecord[] = []
  for (const m of appendix ? elements(appendix).filter((e) => e.name === 'Measurement') : []) {
    const at = 'appendix.Measurement'
    unreadAttributes(m, at, unmapped)
    const strings = elements(m).flatMap((c) => {
      if (c.name === 'charge') return stringOf(c, `${at}.charge`, unmapped, warnings) ?? []
      unmapped.add(`${at}.${c.name}`)
      return []
    })
    if (strings.length === 0) continue
    const data = {
      origin: 'user' as const,
      device: { kind: 'other' as const },
      strings: strings.slice(0, 500).map((s) => ({ load: `user:${load.id}` as const, ...s })),
      provenance: {
        kind: 'measured' as const,
        sources: [{ title: 'Measurements of a ChamberSim Reloaded load file' }],
      },
    }
    sessions.push({ kind: 'session', ...named('session', load.name, data), saved })
  }
  return sessions
}

/**
 * The records of a ChamberSim Reloaded load file: those of `readGrtLoad` (the cartridge, the bullet
 * after its maker, the powder and the load), then a session for each measurement series whose
 * strings name the load. A series maps per charge to a string of shot velocities (m/s) that varies
 * the charge; shot pressures, the display settings and every other part are listed as not read.
 * A format other than 1 gives a warning. Ids come from the content, so a file read again gives the
 * same records. Throws with the reason on a file that is no load file of this format. The caller
 * checks each record with the user record schema.
 */
export function readCsrLoad(xml: string, saved: string): GrtLoadRead {
  const root = parseXml(xml.replace(/^﻿/, ''))
  if (root.name !== csrLoadRoot) throw new Error(`The root element is not ${csrLoadRoot}.`)
  const input = elements(root).find((e) => e.name === 'load')
  if (!input) throw new Error('The file holds no load.')
  const read = readLoadInput(input, saved)
  const format = root.attributes.format
  const warnings =
    format === csrFormat
      ? read.warnings
      : [
          `The file is of format ${format ? `"${format.slice(0, 20)}"` : 'unknown'}; the reader is written for format ${csrFormat}. Check every value.`,
          ...read.warnings,
        ]
  const unmapped = new Set(read.unmapped.filter((u) => u !== 'appendix.Measurement'))
  const load = read.records.at(-1)
  const appendix = elements(input).find((e) => e.name === 'appendix')
  const sessions = load ? sessionsOf(appendix, load, saved, unmapped, warnings) : []
  return { records: [...read.records, ...sessions], unmapped: [...unmapped], warnings }
}
