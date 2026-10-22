import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { chronoFormats, decodeText, parseChrono, readWorkbook } from '../src/index.ts'

// fixed seed: the same inputs on every run
const runs = { seed: 20261022, numRuns: 200 }

/** Runs `read`; a throw passes only as a plain `Error`, the importers' own refusal (a `TypeError` or `RangeError` is a defect). */
async function readsOrRefuses(read: () => unknown) {
  try {
    await read()
  } catch (e) {
    expect(e).toBeInstanceOf(Error)
    expect((e as Error).constructor).toBe(Error)
  }
}

const cell = fc.constantFrom(
  'string',
  'velocity',
  'velocityUnit',
  'coldBore',
  'excluded',
  'fps',
  'm/s',
  'A',
  '2800',
  '2,800',
  '-1',
  '0',
  '1e309',
  'NaN',
  '"',
  '""',
  '#',
  '',
  ' ',
  '\t',
)
/** Text built from the cells and line ends of chronograph files, so parsers get past their first check. */
const fileLike = fc
  .array(fc.array(fc.oneof(cell, fc.string()), { maxLength: 6 }), { maxLength: 8 })
  .chain((rows) =>
    fc
      .constantFrom(',', ';', '\t')
      .chain((d) =>
        fc.constantFrom('\n', '\r\n', '\r').map((eol) => rows.map((r) => r.join(d)).join(eol)),
      ),
  )
const text = fc.oneof(fc.string({ unit: 'binary' }), fileLike)

describe('the importers on any input', () => {
  for (const f of chronoFormats.filter((f) => f.reads === 'text')) {
    it(`${f.id} parses any text or refuses it with an Error`, async () => {
      await fc.assert(
        fc.asyncProperty(text, (t) =>
          readsOrRefuses(() =>
            parseChrono(t, { columns: { string: 1, velocity: 2 }, velocityUnit: 'ft/s' }, f.id),
          ),
        ),
        runs,
      )
    })
  }

  it('detects and parses any text or refuses it with an Error', async () => {
    await fc.assert(
      fc.asyncProperty(text, (t) => readsOrRefuses(() => parseChrono(t))),
      runs,
    )
  })

  it('decodes any bytes or refuses them with an Error', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 64 }), (b) =>
        readsOrRefuses(() => decodeText(b)),
      ),
      runs,
    )
  })

  it('reads any workbook bytes or refuses them with an Error', async () => {
    // the ZIP and the legacy compound file signatures, so the readers get past detection
    const start = fc.constantFrom(
      [],
      [0x50, 0x4b, 0x03, 0x04],
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    )
    await fc.assert(
      fc.asyncProperty(start, fc.uint8Array({ maxLength: 600 }), (s, rest) =>
        readsOrRefuses(() => readWorkbook(Uint8Array.from([...s, ...rest]))),
      ),
      runs,
    )
  })
})
