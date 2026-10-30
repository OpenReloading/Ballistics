import jsQR from 'jsqr'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BoxLabelSheet } from '../src/components/box-label.tsx'
import de from '../src/i18n/de.json'
import { english, translator } from '../src/i18n/translate.ts'
import { boxLabel, labelPayload, qrModules } from '../src/lib/box-label.ts'
import type { LoadRecord } from '../src/lib/load-tabs.ts'
import { presetUnits } from '../src/lib/units.ts'

const id = '3f2a9c1e-7b4d-4e8a-9c6f-1d2e3f4a5b6c'

const record = (data: Partial<LoadRecord['data']> = {}): LoadRecord => ({
  kind: 'load',
  id,
  name: '308 match',
  saved: '2026-03-14T10:00:00.000Z',
  data: {
    origin: 'user',
    cartridge: 'catalogue:308-win',
    bullet: 'catalogue:smk-175',
    powder: 'catalogue:n150',
    charge: { value: 2.85 },
    primer: { record: 'catalogue:br2' },
    seating: { by: 'overallLength', value: { value: 71.12 } },
    ...data,
  },
})

const names: Record<string, string> = {
  'cartridges catalogue:308-win': '.308 Winchester',
  'bullets catalogue:smk-175': 'Test bullet 175',
  'powders catalogue:n150': 'Test powder',
  'primers catalogue:br2': 'Test primer',
}
const nameOf = (kind: string, ref: string | undefined) =>
  ref === undefined ? '' : (names[`${kind} ${ref}`] ?? ref)
const metric = presetUnits('metric-grams')

/** Decodes the matrix from an image of it at 4 px per module, as a scan would. */
function decode(modules: boolean[][]) {
  const scale = 4
  const size = modules.length * scale
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = modules[Math.floor(y / scale)]?.[Math.floor(x / scale)] ? 0 : 255
      pixels.set([v, v, v, 255], (y * size + x) * 4)
    }
  return jsQR(pixels, size, size)?.data
}

describe('box label', () => {
  it('encodes the load id in a versioned payload a reader decodes', () => {
    const label = boxLabel(record(), nameOf, metric, english.t)
    expect(label.payload).toBe(`OR1:L:${id}`)
    expect(decode(qrModules(label.payload))).toBe(labelPayload(id))
  })

  it('gives the same label for the same load', () => {
    const markup = () =>
      renderToStaticMarkup(<BoxLabelSheet label={boxLabel(record(), nameOf, metric, english.t)} />)
    expect(markup()).toBe(markup())
    expect(boxLabel(record(), nameOf, metric, english.t)).toEqual(
      boxLabel(record(), nameOf, metric, english.t),
    )
  })

  it('prints the values of the record and its save day', () => {
    expect(boxLabel(record(), nameOf, metric, english.t)).toEqual({
      title: '308 match',
      rows: [
        ['Cartridge', '.308 Winchester'],
        ['Bullet', 'Test bullet 175'],
        ['Powder', 'Test powder, 2.85 g'],
        ['Primer', 'Test primer'],
        ['COAL', '71.12 mm'],
        ['Saved', '2026-03-14'],
      ],
      payload: `OR1:L:${id}`,
    })
  })

  it('prints a lot only when it is typed', () => {
    const rows = boxLabel(
      record({ powderLot: 'P-123', primer: { record: 'catalogue:br2', lot: 'Z-9' } }),
      nameOf,
      metric,
      english.t,
    ).rows
    expect(rows).toContainEqual(['Powder lot', 'P-123'])
    expect(rows).toContainEqual(['Primer lot', 'Z-9'])
    expect(rows.some(([k]) => k === 'Case lot')).toBe(false)
  })

  it('prints in German', () => {
    const rows = boxLabel(record(), nameOf, metric, translator(de, 'de').t).rows
    expect(rows.map(([k]) => k)).toContain('Gespeichert')
  })
})
