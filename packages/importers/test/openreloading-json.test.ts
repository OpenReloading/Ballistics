import { describe, expect, it } from 'vitest'
import {
  detectFormat,
  isOpenReloadingJson,
  parseChrono,
  parseOpenReloadingJson,
  stringifyOpenReloadingJson,
} from '../src/index.ts'
import { complete } from './complete.ts'
import { refusal } from './refusal.ts'

const file = {
  format: 'openreloading-session',
  version: 1,
  date: '2026-03-05',
  device: { kind: 'doppler-radar', manufacturerName: 'Manufacturer', model: 'Model' },
  muzzleDistance: 4.57,
  note: 'range day',
  strings: [
    {
      label: 'A',
      shots: [
        { velocity: 853.5, coldBore: true },
        { velocity: 856.1 },
        { velocity: 700, excluded: 'flyer' },
      ],
    },
    // a shot left out in range mode
    { shots: [{ velocity: 862.9 }, { velocity: 701, excluded: true }] },
  ],
}
const text = JSON.stringify(file)

/** Files the reader refuses, each with the diagnostic it refuses them with. */
const at = (code: string, path: string) => ({ code, params: { path } })
const refusals: [string, object, object][] = [
  ['version 2', { ...file, version: 2 }, { code: 'versionUnsupported', params: { version: '2' } }],
  ['no strings', { ...file, strings: [] }, at('noStrings', 'strings')],
  ['empty string', { ...file, strings: [{ shots: [] }] }, at('noStringShots', 'strings[0].shots')],
  [
    'text velocity',
    { ...file, strings: [{ shots: [{ velocity: '800' }] }] },
    at('memberNotPositive', 'strings[0].shots[0].velocity'),
  ],
  [
    'no velocity',
    { ...file, strings: [{ shots: [{}] }] },
    at('velocityRequired', 'strings[0].shots[0].velocity'),
  ],
  [
    'zero velocity',
    { ...file, strings: [{ shots: [{ velocity: 0 }] }] },
    at('memberNotPositive', 'strings[0].shots[0].velocity'),
  ],
  ['bad date', { ...file, date: '05.03.2026' }, at('memberNotDate', 'date')],
  [
    'bad kind',
    { ...file, device: { kind: 'laser' } },
    {
      code: 'memberNotDeviceKind',
      params: { path: 'device.kind', kinds: ['doppler-radar', 'optical', 'magnetic', 'other'] },
    },
  ],
  [
    'empty reason',
    { ...file, strings: [{ shots: [{ velocity: 800, excluded: '' }] }] },
    at('excludedNotText', 'strings[0].shots[0].excluded'),
  ],
  ['text date', { ...file, date: 20260305 }, at('memberNotDate', 'date')],
  ['device as text', { ...file, device: 'radar' }, at('memberNotObject', 'device')],
  [
    'empty model',
    { ...file, device: { kind: 'other', model: '' } },
    at('memberNotText', 'device.model'),
  ],
  [
    'number maker',
    { ...file, device: { kind: 'other', manufacturerName: 7 } },
    at('memberNotText', 'device.manufacturerName'),
  ],
  [
    'negative distance',
    { ...file, muzzleDistance: -1 },
    at('memberNotPositive', '.muzzleDistance'),
  ],
  ['empty note', { ...file, note: '' }, at('memberNotText', 'note')],
  ['string as list', { ...file, strings: [[]] }, at('memberNotObject', 'strings[0]')],
  [
    'number label',
    { ...file, strings: [{ label: 1, shots: [{ velocity: 800 }] }] },
    at('memberNotText', 'strings[0].label'),
  ],
  [
    'shot as number',
    { ...file, strings: [{ shots: [800] }] },
    at('memberNotObject', 'strings[0].shots[0]'),
  ],
  [
    'text cold bore',
    { ...file, strings: [{ shots: [{ velocity: 800, coldBore: 'yes' }] }] },
    at('memberNotBoolean', 'strings[0].shots[0].coldBore'),
  ],
]

describe('OpenReloading session JSON: detection and missing fields', () => {
  it('is detected before every CSV format and read in m/s', () => {
    expect(isOpenReloadingJson(text)).toBe(true)
    expect(detectFormat(text)).toBe('openreloading-json')
    expect(detectFormat(`﻿${text}`)).toBe('openreloading-json')
    const r = parseChrono(text, { fileName: 'session.json' })
    expect(r?.format).toBe('openreloading-json')
    expect(r?.stringLabels).toEqual(['A', undefined])
    expect(r?.session.strings[0]?.shots).toEqual([
      { velocity: { value: 853.5, raw: '853.5 m/s' }, coldBore: true },
      { velocity: { value: 856.1, raw: '856.1 m/s' } },
      { velocity: { value: 700, raw: '700 m/s' }, excluded: 'flyer' },
    ])
    expect(r?.velocityUnits).toEqual([{ unit: 'm/s', source: 'file' }])
    expect(r?.session.date).toBe('2026-03-05')
    expect(r?.session.device).toEqual({
      kind: 'doppler-radar',
      manufacturerName: 'Manufacturer',
      model: 'Model',
    })
    // m in the file, mm stored
    expect(r?.session.muzzleDistance).toEqual({ value: 4570, raw: '4.57 m' })
    expect(r && complete(r).strings).toHaveLength(2)
  })

  it('asks for the device and the date only when the file has none', () => {
    const r = parseOpenReloadingJson(
      JSON.stringify({
        format: 'openreloading-session',
        version: 1,
        strings: [{ shots: [{ velocity: 800 }] }],
      }),
    )
    expect(r.session.device.kind).toBe('other')
    expect(r.missingPaths).toEqual(
      expect.arrayContaining(['date', 'device.manufacturer', 'device.model', 'strings.0.load']),
    )
  })
})

describe('OpenReloading session JSON: writing, and other JSON', () => {
  it('writes what it reads', () => {
    const r = parseOpenReloadingJson(text)
    const again = parseOpenReloadingJson(stringifyOpenReloadingJson(r))
    expect(again.session).toEqual({ ...r.session, provenance: again.session.provenance })
    expect(again.stringLabels).toEqual(r.stringLabels)
    expect(JSON.parse(stringifyOpenReloadingJson(r))).toEqual(file)
  })

  it('reads coldBore false as unset and writes only the members the session has', () => {
    const r = parseOpenReloadingJson(
      JSON.stringify({
        format: 'openreloading-session',
        version: 1,
        strings: [{ label: '', shots: [{ velocity: 800, coldBore: false }] }],
      }),
    )
    expect(r.session.strings[0]?.shots[0]).toEqual({ velocity: { value: 800, raw: '800 m/s' } })
    expect(r.stringLabels).toEqual([undefined])
    expect(JSON.parse(stringifyOpenReloadingJson(r))).toEqual({
      format: 'openreloading-session',
      version: 1,
      device: { kind: 'other' },
      strings: [{ shots: [{ velocity: 800 }] }],
    })
  })

  it('does not claim other JSON or text', () => {
    expect(isOpenReloadingJson('{"format":"other"}')).toBe(false)
    expect(isOpenReloadingJson('{not json')).toBe(false)
    expect(isOpenReloadingJson('string,velocity\nA,2795\n')).toBe(false)
  })
})

describe('OpenReloading session JSON: refused members', () => {
  it.each(refusals)('refuses %s', (_, bad, diagnostic) => {
    expect(refusal(() => parseOpenReloadingJson(JSON.stringify(bad)))).toEqual(diagnostic)
  })
})
