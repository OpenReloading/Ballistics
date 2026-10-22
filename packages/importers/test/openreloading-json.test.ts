import { describe, expect, it } from 'vitest'
import {
  detectFormat,
  isOpenReloadingJson,
  parseChrono,
  parseOpenReloadingJson,
  stringifyOpenReloadingJson,
} from '../src/index.ts'
import { complete } from './complete.ts'

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
    { shots: [{ velocity: 862.9 }] },
  ],
}
const text = JSON.stringify(file)

describe('OpenReloading session JSON', () => {
  it('is detected before every CSV format and read in m/s', () => {
    expect(isOpenReloadingJson(text)).toBe(true)
    expect(detectFormat(text)).toBe('openreloading-json')
    expect(detectFormat(`﻿${text}`)).toBe('openreloading-json')
    const r = parseChrono(text, { fileName: 'session.json' })
    expect(r?.format).toBe('openreloading-json')
    expect(r?.stringLabels).toEqual(['A', undefined])
    expect(r?.session.strings[0].shots).toEqual([
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
      expect.arrayContaining(['date', 'device.manufacturerName', 'device.model', 'strings.0.load']),
    )
  })

  it('writes what it reads', () => {
    const r = parseOpenReloadingJson(text)
    const again = parseOpenReloadingJson(stringifyOpenReloadingJson(r))
    expect(again.session).toEqual({ ...r.session, provenance: again.session.provenance })
    expect(again.stringLabels).toEqual(r.stringLabels)
    expect(JSON.parse(stringifyOpenReloadingJson(r))).toEqual(file)
  })

  it('does not claim other JSON or text', () => {
    expect(isOpenReloadingJson('{"format":"other"}')).toBe(false)
    expect(isOpenReloadingJson('{not json')).toBe(false)
    expect(isOpenReloadingJson('string,velocity\nA,2795\n')).toBe(false)
  })

  it.each([
    ['version 2', { ...file, version: 2 }, 'version 2 is not supported'],
    ['no strings', { ...file, strings: [] }, 'strings: must list at least one string'],
    ['empty string', { ...file, strings: [{ shots: [] }] }, 'strings[0].shots'],
    [
      'text velocity',
      { ...file, strings: [{ shots: [{ velocity: '800' }] }] },
      'strings[0].shots[0].velocity: must be a positive number',
    ],
    [
      'no velocity',
      { ...file, strings: [{ shots: [{}] }] },
      'strings[0].shots[0].velocity: is required',
    ],
    [
      'zero velocity',
      { ...file, strings: [{ shots: [{ velocity: 0 }] }] },
      'must be a positive number',
    ],
    ['bad date', { ...file, date: '05.03.2026' }, 'date: must be a date as YYYY-MM-DD'],
    ['bad kind', { ...file, device: { kind: 'laser' } }, 'device.kind'],
    [
      'empty reason',
      { ...file, strings: [{ shots: [{ velocity: 800, excluded: '' }] }] },
      'excluded',
    ],
  ])('refuses %s', (_, bad, message) => {
    expect(() => parseOpenReloadingJson(JSON.stringify(bad))).toThrow(message)
  })
})
