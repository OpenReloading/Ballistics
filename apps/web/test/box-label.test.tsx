import jsQR from 'jsqr'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { BoxLabelSheet } from '../src/components/box-label.tsx'
import de from '../src/i18n/de.json'
import { english, translator } from '../src/i18n/translate.ts'
import { boxLabel, labelledLoad, labelPayload, qrModules, readLabel } from '../src/lib/box-label.ts'
import { photoTries, readCode, type Try } from '../src/lib/label-reader.ts'
import type { LoadRecord } from '../src/lib/load-tabs.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

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

describe('box label reader', () => {
  it('finds the load id in plain text, a web address and the bare id', () => {
    expect(readLabel(`OR1:L:${id}`)).toBe(id)
    expect(readLabel(`  printed: OR1:L:${id.toUpperCase()}\n`)).toBe(id)
    expect(readLabel(`https://example.org/scan?c=OR1:L:${id}&x=1`)).toBe(id)
    expect(readLabel(`https://example.org/scan?c=OR1%3AL%3A${id}`)).toBe(id)
    expect(readLabel(` ${id} `)).toBe(id)
  })

  it('rejects another version or kind and garbage', () => {
    expect(readLabel(`OR2:L:${id}`)).toBeUndefined()
    expect(readLabel(`OR1:X:${id}`)).toBeUndefined()
    expect(readLabel('OR1:L:not-an-id')).toBeUndefined()
    expect(readLabel(`load ${id} of 2026`)).toBeUndefined()
    expect(readLabel('%E0%A4%A garbage')).toBeUndefined()
    expect(readLabel('')).toBeUndefined()
  })

  it('looks the id up among the stored loads', () => {
    const r = record()
    expect(labelledLoad(id, { records: [r], invalid: [] })).toBe(r)
    expect(labelledLoad(id, { records: [], invalid: [{ raw: {}, error: 'x', id }] })).toBe(
      'invalid',
    )
    expect(labelledLoad(id, { records: [], invalid: [] })).toBe('missing')
    expect(
      // a record of another kind under the id: the cast stands in for one
      labelledLoad(id, {
        records: [{ ...r, kind: 'firearm' } as unknown as LoadRecord],
        invalid: [],
      }),
    ).toBe('missing')
  })

  it('reads the whole picture bounded, then its middle half', () => {
    expect(photoTries(4000, 3000)).toEqual([
      { x: 0, y: 0, w: 4000, h: 3000, width: 1280, height: 960 },
      { x: 1000, y: 750, w: 2000, h: 1500, width: 1280, height: 960 },
    ])
    expect(photoTries(600, 400)[0]).toMatchObject({ width: 600, height: 400 })
  })

  /** The printed label's QR code as the label sheet renders it, rasterised at `px` per side. */
  function labelCode(px: number) {
    const markup = renderToStaticMarkup(
      <BoxLabelSheet label={boxLabel(record(), nameOf, metric, english.t)} />,
    )
    const svg = /<svg[\s\S]*?<\/svg>/.exec(markup)?.[0] ?? ''
    // React leaves out the namespace a standalone SVG file needs
    return sharp(Buffer.from(svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')))
      .resize(px, px, { kernel: 'nearest' })
      .flatten({ background: '#fff' })
      .png()
      .toBuffer()
  }

  /** Reads `photo` part by part as the dialog does, each part drawn at its size. */
  async function readAsDialog(photo: Buffer) {
    const { width = 0, height = 0 } = await sharp(photo).metadata()
    for (const t of photoTries(width, height)) {
      const part = (p: Try) =>
        sharp(photo)
          .extract({ left: Math.round(p.x), top: Math.round(p.y), width: p.w, height: p.h })
          .resize(p.width, p.height)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
      const { data, info } = await part(t)
      const text = await readCode({
        data: new Uint8ClampedArray(data),
        width: info.width,
        height: info.height,
      })
      if (text) return text
    }
    return
  }

  it('opens the load of a label rendered by the label sheet', async () => {
    const text = await readAsDialog(await labelCode(400))
    expect(
      labelledLoad(defined(readLabel(defined(text))), { records: [record()], invalid: [] }),
    ).toEqual(record())
  })

  // shortcut: a phone photo simulated from the render (small in the frame, turned, blurred, grey
  // paper, JPEG), not a photo of a printed label; replace it with one when a device is at hand
  it('reads a small, turned and blurred label in a large photo-like picture', async () => {
    const code = await sharp(await labelCode(320))
      .rotate(8, { background: '#e8e4dc' })
      .toBuffer()
    const photo = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: '#d9d4ca' },
    })
      .composite([{ input: code, left: 1900, top: 1300 }])
      .blur(1.5)
      .linear(0.7, 40)
      .jpeg({ quality: 60 })
      .toBuffer()
    expect(readLabel(defined(await readAsDialog(photo)))).toBe(id)
  })

  it('finds no code in a picture without one', async () => {
    const blank = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    expect(await readAsDialog(blank)).toBeUndefined()
  })
})
