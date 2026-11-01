import { applyOverrides, type Bullet, bullet, userBullet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { designerSpecs, evaluate, fileData } from '../src/lib/bullet-designer.ts'
import { grayOf, scaleOf, segment } from '../src/lib/bullet-photo.ts'
import {
  measuredFor,
  photoDesign,
  photoNote,
  photoRows,
  storedText,
  valueText,
} from '../src/lib/bullet-photo-design.ts'
import { measureOutline } from '../src/lib/bullet-photo-measure.ts'
import { fitOutline } from '../src/lib/bullet-photo-outline.ts'
import { renderPhoto, sampleShape } from '../src/lib/bullet-photo-sample.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'
import { targetBullet } from './fixtures/bullets.ts'

const system = presetUnits('metric-grams')

function measure(shape = sampleShape) {
  const photo = renderPhoto({
    shape,
    pxPerMm: 28,
    width: 1300,
    height: 640,
    base: { x: 180, y: 250 },
    angle: 0.05,
    paper: 225,
    bullet: 110,
    gradient: 0,
    shading: 0,
    noise: 1,
    blur: 0.7,
    ruler: { x0: 30, y: 540, heightPx: 70, lengthMm: 40, toEdges: true },
    seed: 5,
  })
  const span = defined(photo.span)
  const scale = defined(scaleOf([span]))
  const outline = defined(fitOutline(segment(grayOf(photo.image), [span.a, span.b])))
  return { m: measureOutline(outline, scale), facts: { width: 1300, height: 640, scale } }
}

describe('the design a photograph seeds', () => {
  for (const [name, shape] of Object.entries({
    'a tangent boat tail with a cannelure': sampleShape,
    'a secant ogive on a flat base': {
      diameter: 7.82,
      length: 30,
      noseLength: 17.5,
      meplatDiameter: 0.5,
      ogive: { form: 'secant', radiusRatio: 0.7 },
    },
  }))
    it(`draws ${name} without a refusal and keeps the uncertainties in a note`, () => {
      const { m, facts } = measure(shape)
      const design = photoDesign(m, facts, system)
      const e = evaluate(design, system)
      expect(e.refusal).toBeUndefined()
      expect(e.drawing).toBeDefined()
      expect(design.fields.mass?.si).toBeUndefined()
      const saved = fileData(design)
      const note = defined(saved.overrides?.note)
      expect(note).toMatch(/Measured from a photograph/)
      expect(note).toMatch(/length \d+\.\d+ ± \d+\.\d+ mm/)
      expect(note).toMatch(/no image stored/)
    })

  it('takes the nose form and the base type the photograph shows', () => {
    const { m, facts } = measure()
    const design = photoDesign(m, facts, system)
    expect(design.choices['ogive.form']).toBe('tangent')
    expect(design.choices['base.type']).toBe('boat-tail')
    expect(design.fields['ogive.radiusRatio']?.si).toBe(1)
    expect(design.fields['ogive.radius']?.si).toBeUndefined()
  })

  it('gives a record that its schema accepts when saved over a base', () => {
    const { m, facts } = measure()
    const saved = fileData(photoDesign(m, facts, system))
    expect(saved.origin).toBe('user')
    expect(saved.overrides?.diameter?.value).toBeCloseTo(7.82, 1)
  })
})

describe('the values table', () => {
  const { m, facts } = measure()

  it('shows each value with its uncertainty in the unit of the preset', () => {
    const rows = photoRows(m, undefined)
    const length = defined(rows.find((r) => r.spec.key === 'length'))
    expect(valueText(length.spec, system, length.value)).toMatch(/^31\.\d+ ± 0\.0\d+ mm$/)
    const ratio = defined(rows.find((r) => r.spec.key === 'ogive.radiusRatio'))
    expect(valueText(ratio.spec, system, ratio.value)).toMatch(/^1\.0\d* ± 0\.0\d+$/)
    const imperial = presetUnits('us')
    expect(valueText(length.spec, imperial, length.value)).toMatch(/ in$/)
  })

  it('flags a photograph far from the chosen record, and not a close one', () => {
    const spec = (k: string) => defined(designerSpecs.find((s) => s.key === k))
    // the record's values in SI (m)
    const close = photoRows(m, { length: 31.5e-3, diameter: 7.82e-3 })
    expect(close.every((r) => !r.differs)).toBe(true)
    const far = photoRows(m, { length: 36e-3, diameter: 7.82e-3 })
    expect(defined(far.find((r) => r.spec.key === 'length')).differs).toBe(true)
    expect(defined(far.find((r) => r.spec.key === 'diameter')).differs).toBe(false)
    expect(storedText(spec('length'), system, 36)).toBe('36.00 mm')
  })

  it('says the scale and that no image is stored', () => {
    expect(photoNote(m, facts)).toMatch(/28\.\d+ px\/mm ± 0\.\d+ %/)
    expect(photoNote(m, facts)).not.toMatch(/scale comes from/)
  })

  it('keeps what a scale from the diameter alone rests on', () => {
    const note = photoNote({ ...m, scaleBasis: 'diameter' }, facts)
    expect(note).toMatch(
      /no image stored\)\. The scale comes from the diameter entered, without a ruler/,
    )
    expect(note).toMatch(/1\.5 % short.*Values with standard uncertainty/)
  })
})

it('saves a user bullet the schema accepts, and over a base a record it accepts', () => {
  const { m, facts } = measure()
  const saved = userBullet.parse(fileData(photoDesign(m, facts, system)))
  const resolved = bullet.parse(applyOverrides<Bullet>(targetBullet, saved.overrides ?? {}))
  expect(resolved.note).toMatch(/Measured from a photograph/)
})

describe('measuredFor', () => {
  const cut = { alpha: new Uint8Array(4), rev: 1 }
  const scale = { pxPerMm: 30, relUncertainty: 0.001 }

  it('holds only while the cut-out, the scale and the axis are those it was measured from', () => {
    const made = { cut, scale, axis: undefined }
    expect(measuredFor(made, { cut, scale, axis: undefined })).toBe(true)
    expect(measuredFor(made, { cut: { ...cut, rev: 2 }, scale, axis: undefined })).toBe(false)
    expect(measuredFor(made, { cut, scale: { ...scale }, axis: undefined })).toBe(false)
    expect(measuredFor(made, { cut, scale: undefined, axis: undefined })).toBe(false)
    expect(measuredFor(made, { cut, scale, axis: 0.1 })).toBe(false)
  })
})
