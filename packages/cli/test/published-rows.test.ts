import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { interior, lbPerSqInToKgPerSqM, standardAtmosphere, trajectory } from '@open-reloading/core'
import type { PublishedLoads } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { compare, verify } from '../src/commands.ts'
import { Refusal, UsageError } from '../src/errors.ts'
import { atMuzzle, predict } from '../src/evaluate.ts'
import { run } from '../src/main.ts'
import { fillInputs, lengthModel, rowsFromPublished, standInId } from '../src/published-rows.ts'
import { loadRecords } from '../src/records.ts'
import { result } from '../src/result.ts'
import type { Row } from '../src/rows.ts'
import { recordRoots, records } from './fixture.ts'

// Test data, not maker data: the printed figures of these tables are the model's own results
// for the demo records, moved by known errors, as the synthetic rows of `data.ts`.

const source = {
  title: 'Synthetic published load table (test data)',
  publisher: 'Demo Powder',
  url: 'https://example.org/synthetic-table.pdf',
  retrieved: '2026-01-01',
  origin: 'manufacturer' as const,
}

const figure = (value: number, unit: string) => {
  const v = Number(value.toPrecision(7))
  return { value: v, raw: `${v} ${unit}` }
}

type Charge = PublishedLoads['loads'][number]['charges'][number]
type Load = PublishedLoads['loads'][number]

const charge = (kind: Charge['kind'], grams: number, extra: Partial<Charge> = {}): Charge => ({
  kind,
  charge: figure(grams, 'g'),
  ...extra,
})

const load = (id: string, charges: Charge[], extra: Partial<Load> = {}): Load => ({
  id,
  bullet: { printed: 'Demo 168', mass: figure(10.886, 'g'), record: 'catalogue:demo-bullet-168' },
  powder: { printed: 'DP40', record: 'catalogue:demo-powder-dp40' },
  barrel: { length: figure(600, 'mm') },
  charges,
  page: '1',
  ...extra,
})

const table = (cartridge: string, loads: Load[], extra: Partial<PublishedLoads> = {}) =>
  ({
    id: 'demo-powder',
    maker: 'demo-powder',
    producedBy: 'maker',
    cartridgeName: cartridge,
    cartridge: `catalogue:${cartridge}`,
    loads,
    provenance: { kind: 'published', sources: [source] },
    ...extra,
  }) as PublishedLoads

/** The model's muzzle velocity (m/s) and pressure (bar) for a charge of the demo load in `cartridge`. */
function model(cartridge: string, grams: number, bullet = 'demo-bullet-168') {
  const row: Row = {
    line: 0,
    cartridge,
    bullet,
    powder: 'demo-powder-dp40',
    charge: Number(grams.toPrecision(7)),
    velocity: 0,
    barrel: 600,
  }
  const p = predict(row, records, interior)
  if (!('velocity' in p)) throw new Error(`no model result: ${p.reason}`)
  return { velocity: p.velocity, pressure: p.pressure / 1e5 }
}

/** The speed the demo bullet keeps at `distance` m from a muzzle velocity, in the sea-level standard atmosphere. */
function flown(muzzleVelocity: number, distance: number) {
  const bullet = records.bullets.get('demo-bullet-168')
  const g1 = bullet?.ballisticCoefficients?.find((c) => c.dragModel === 'G7')?.value ?? 0
  const t = trajectory(
    {
      projectile: {
        mass: 10.886e-3,
        diameter: 7.823e-3,
        drag: {
          kind: 'bc',
          model: 'G7',
          bands: [{ ballisticCoefficient: g1 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
        },
      },
      muzzleVelocity,
      firearm: { sightHeight: 0 },
      air: standardAtmosphere(0),
      zero: { elevationAngle: 0, windageAngle: 0 },
    },
    [distance],
    { model: 'point-mass', coriolis: false, spinDrift: false, jump: false },
  )
  return t.points[0]?.velocity ?? Number.NaN
}

/** Writes `files` as `<root>/loads/<cartridge>/<id>.json` and returns the loads folder. */
function writeLoads(files: PublishedLoads[]) {
  const root = mkdtempSync(join(tmpdir(), 'cli-published-'))
  for (const f of files) {
    const dir = join(root, 'loads', f.cartridge.replace('catalogue:', ''))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${f.id}.json`), JSON.stringify(f))
  }
  return join(root, 'loads')
}

describe('rowsFromPublished', () => {
  const v = (value: number, distance?: number) => ({
    ...figure(value, 'm/s'),
    ...(distance !== undefined && {
      point: { label: 'V5', distance: figure(distance * 1000, 'mm') },
    }),
  })

  it('gives one row per charge with a velocity, with its figures', () => {
    const file = table('308-win', [
      load(
        'a',
        [
          charge('start', 2.0, {
            velocity: v(800),
            pressure: {
              unit: 'bar',
              peak: figure(3000, 'bar'),
              method: 'transducer',
              methodBasis: 'stated',
            },
          }),
          charge('max', 2.2, { velocity: v(850, 5) }),
        ],
        { coal: figure(71, 'mm') },
      ),
    ])
    const { rows, skipped } = rowsFromPublished([file])
    expect(skipped).toEqual({})
    expect(rows).toEqual([
      {
        line: 1,
        cartridge: '308-win',
        bullet: 'demo-bullet-168',
        powder: 'demo-powder-dp40',
        charge: 2,
        velocity: 800,
        pressure: 3000,
        pressureBasis: 'transducer',
        muzzleDistance: undefined,
        barrel: 600,
        coal: 71,
        table: 'demo-powder',
      },
      {
        line: 2,
        cartridge: '308-win',
        bullet: 'demo-bullet-168',
        powder: 'demo-powder-dp40',
        charge: 2.2,
        velocity: 850,
        pressure: undefined,
        pressureBasis: undefined,
        muzzleDistance: 5,
        barrel: 600,
        coal: 71,
        table: 'demo-powder',
      },
    ])
  })

  it('keeps a crusher figure out of the pressure and names the basis of an unstated method', () => {
    const cup = {
      unit: 'CUP' as const,
      peak: { raw: '40,000 CUP' },
      method: 'crusher' as const,
      methodBasis: 'from-unit' as const,
    }
    const plain = { unit: 'bar' as const, peak: figure(3000, 'bar') }
    const { rows } = rowsFromPublished([
      table('308-win', [
        load('a', [charge('single', 2, { velocity: v(800), pressure: cup })]),
        load('b', [charge('single', 2, { velocity: v(800), pressure: plain })]),
      ]),
    ])
    expect(rows.map((r) => [r.pressure, r.pressureBasis])).toEqual([
      [undefined, 'crusher'],
      [3000, 'unstated'],
    ])
  })

  it('counts the charges it skips by reason and never reads a customer table', () => {
    const { rows, skipped } = rowsFromPublished(
      [
        table('308-win', [
          load('a', [charge('start', 2), charge('max', 2.2, { velocity: v(850) })]),
          load('b', [charge('single', 2, { velocity: v(800) })], {
            powder: { printed: 'Unknown powder' },
          }),
        ]),
        table('308-win', [load('c', [charge('single', 2, { velocity: v(800) })])], {
          id: 'demo-powder-customer',
          producedBy: 'customer',
        }),
        table('no-cartridge', [load('d', [charge('single', 2, { velocity: v(800) })])]),
      ],
      new Set(['308-win']),
    )
    expect(rows).toHaveLength(1)
    expect(skipped).toEqual({ noVelocity: 1, noPowderRecord: 1, customerTable: 1, noCartridge: 1 })
  })

  it('names a stand-in bullet for a printed bullet without a record', () => {
    const { rows } = rowsFromPublished([
      table('308-win', [
        load('a', [charge('single', 2, { velocity: v(800) })], {
          bullet: { printed: 'FMJ', mass: figure(9.72, 'g') },
        }),
      ]),
    ])
    expect(rows[0]?.bullet).toBe(standInId('308-win', 9.72))
    expect(rows[0]?.bullet).toBe('stand-in-308-win-9720mg')
    expect(rows[0]?.bulletMass).toBe(9.72)
  })
})

describe('the inputs published rows do not carry', () => {
  const base: Row = {
    line: 1,
    cartridge: '308-win',
    bullet: 'demo-bullet-168',
    powder: 'demo-powder-dp40',
    charge: 2,
    velocity: 800,
  }

  it('builds a stand-in bullet of the cartridge G1, the printed mass and the modelled length', () => {
    const own = loadRecords(recordRoots)
    const id = standInId('308-win', 9.72)
    const [row] = fillInputs([{ ...base, bullet: id, bulletMass: 9.72, barrel: 600 }], own)
    const bullet = own.bullets.get(id)
    const g1 = own.cartridges.get('308-win')?.values.find((x) => x.symbol === 'G1')?.value
    expect(row?.bullet).toBe(id)
    expect(bullet?.mass.value).toBe(9.72)
    expect(bullet?.diameter?.value).toBe(g1)
    const length = lengthModel(records.bullets.values())?.(9.72, g1 as number)
    expect(bullet?.length?.value).toBeCloseTo(length as number, 9)
    // a longer bullet of the same diameter is heavier
    expect(lengthModel(records.bullets.values())?.(11, 7.8)).toBeGreaterThan(length as number)
    expect(lengthModel([])).toBeUndefined()
  })

  it('takes the median printed barrel of the cartridge, else one by case length', () => {
    const own = loadRecords(recordRoots)
    const rows = fillInputs(
      [
        { ...base, barrel: 500 },
        { ...base, barrel: 600 },
        { ...base, barrel: 700 },
        base,
        { ...base, cartridge: '30-br' },
        { ...base, cartridge: 'no-cartridge' },
      ],
      own,
    )
    expect(rows.map((r) => r.barrel)).toEqual([500, 600, 700, 600, 610, undefined])
  })
})

describe('verify on published loads', () => {
  const grams = [2.0, 2.2, 2.4]
  /** The validation cartridge 308-win: one row at the muzzle, one at V5 and one CUP row, each at its model velocity. */
  const validation = () => {
    const [a, b, c] = grams.map((g) => model('308-win', g))
    if (!a || !b || !c) throw new Error('no model')
    return table('308-win', [
      load('a', [
        charge('single', 2.0, {
          velocity: figure(a.velocity, 'm/s'),
          pressure: {
            unit: 'bar',
            peak: figure(a.pressure / 1.1, 'bar'),
            method: 'transducer',
            methodBasis: 'stated',
          },
        }),
      ]),
      load('b', [
        charge('single', 2.2, {
          velocity: {
            ...figure(flown(b.velocity, 5), 'm/s'),
            point: { label: 'V5', distance: figure(5000, 'mm') },
          },
          pressure: {
            unit: 'psi',
            peak: { value: Number((b.pressure / 1.2).toPrecision(7)), raw: 'case-contact psi' },
            method: 'case-contact',
            methodBasis: 'stated',
          },
        }),
      ]),
      load('c', [
        charge('single', 2.4, {
          velocity: figure(c.velocity, 'm/s'),
          pressure: {
            unit: 'CUP',
            peak: { raw: '40,000 CUP' },
            method: 'crusher',
            methodBasis: 'from-unit',
          },
        }),
      ]),
    ])
  }
  const training = () =>
    table(
      '30-br',
      [0.01, -0.02, 0.03].map((e, i) =>
        load(`t${i}`, [
          charge('single', grams[i] as number, {
            velocity: figure(model('30-br', grams[i] as number).velocity / (1 + e), 'm/s'),
          }),
        ]),
      ),
    )
  const customer = () => ({
    ...validation(),
    id: 'demo-powder-customer',
    producedBy: 'customer' as const,
  })

  it('reads the folder, corrects the V5 row to the muzzle and groups pressure by basis', async () => {
    const folder = writeLoads([validation(), training(), customer()])
    const r = await verify({
      rows: folder,
      records: recordRoots,
      split: 'validation',
      final: false,
    })
    expect(r.schemaVersion).toBe(2)
    expect(r.published).toEqual({ files: 3, rows: 6, skipped: { customerTable: 3 } })
    expect(r.overall.rows.used).toBe(3)
    // every row is printed at the model's own velocity, the V5 row at the speed flown to 5 m
    expect(r.overall.velocity?.p90).toBeLessThan(1e-6)
    expect(r.overall.pressureByBasis).toEqual({
      'case-contact': { median: expect.closeTo(0.2, 5), p90: expect.closeTo(0.2, 5), rows: 1 },
      transducer: { median: expect.closeTo(0.1, 5), p90: expect.closeTo(0.1, 5), rows: 1 },
    })
    expect(r.interval.trainingRows).toBe(3)
  })

  it('compares a V5 row uncorrected only where it has no distance', () => {
    const own = loadRecords(recordRoots)
    const row: Row = {
      ...{
        line: 1,
        cartridge: '308-win',
        bullet: 'demo-bullet-168',
        powder: 'demo-powder-dp40',
        charge: 2,
        velocity: 800,
      },
    }
    expect(atMuzzle(row, own)).toBe(row)
    const corrected = atMuzzle({ ...row, muzzleDistance: 5 }, own)
    expect('velocity' in corrected && corrected.velocity).toBeGreaterThan(800)
    expect('velocity' in corrected && corrected.printedVelocity).toBe(800)
    expect(atMuzzle({ ...row, bullet: 'demo-bullet-150-none', muzzleDistance: 5 }, own)).toEqual({
      reason: 'noBulletDrag',
    })
    expect(atMuzzle({ ...row, velocity: 1, muzzleDistance: 5000 }, own)).toEqual({
      reason: 'noBulletDrag',
    })
  })

  it('keeps the test split sealed and the split of each cartridge', async () => {
    const folder = writeLoads([validation(), training()])
    await expect(
      verify({ rows: folder, records: recordRoots, split: 'test', final: false }),
    ).rejects.toBeInstanceOf(Refusal)
    const t = await verify({ rows: folder, records: recordRoots, split: 'training', final: false })
    expect(t.overall.rows.inSplit).toBe(3)
    expect(Object.keys(t.byPowder)).toEqual(['demo-powder-dp40'])
  })

  it('refuses a folder that is not named loads and published loads without a row', async () => {
    const folder = writeLoads([validation()])
    await expect(
      verify({
        rows: join(folder, '308-win', '..', '..'),
        records: recordRoots,
        split: 'validation',
        final: false,
      }),
    ).rejects.toBeInstanceOf(UsageError)
    const empty = writeLoads([
      { ...validation(), producedBy: 'customer', id: 'demo-powder-customer' },
    ])
    await expect(
      verify({ rows: empty, records: recordRoots, split: 'validation', final: false }),
    ).rejects.toThrow('the published loads give no row')
  })

  it('reads the catalogue of the records for --rows catalogue', async () => {
    const folder = writeLoads([validation(), training()])
    const r = await verify({
      rows: 'catalogue',
      records: [...recordRoots, join(folder, '..')],
      split: 'validation',
      final: false,
    })
    expect(r.published).toEqual({ files: 2, rows: 6, skipped: {} })
  })

  it('is uncorrected the speed at 5 m, below the muzzle value', () => {
    const { velocity } = model('308-win', 2.2)
    expect(flown(velocity, 5) / velocity).toBeLessThan(0.999)
  })

  it('runs from the command line on --rows catalogue, as JSON and as a table', async () => {
    const folder = writeLoads([validation(), training()])
    const roots = [...recordRoots, join(folder, '..')].flatMap((r) => ['--records', r])
    const out = { stdout: '', stderr: '' }
    const io = {
      stdout: (t: string) => {
        out.stdout += t
      },
      stderr: (t: string) => {
        out.stderr += t
      },
      tty: false,
    }
    const args = ['verify', '--rows', 'catalogue', '--split', 'validation', ...roots]
    expect(await run(args, {}, io)).toBe(0)
    const json = result.parse(JSON.parse(out.stdout))
    expect(json.published?.rows).toBe(6)
    out.stdout = ''
    expect(await run([...args, '--table'], {}, io)).toBe(0)
    expect(out.stdout).toContain('published loads: 2 files, 6 rows')
    expect(out.stdout).toContain(
      'pressure by basis, median / P90: case-contact 20.0 / 20.0 % (1 rows)',
    )
  })

  it('flies the G7 bands of a bullet record, else its G1 ones, and refuses alternatives', () => {
    const own = loadRecords(recordRoots)
    const demo = own.bullets.get('demo-bullet-168')
    if (!demo) throw new Error('no demo bullet')
    const row: Row = {
      line: 1,
      cartridge: '308-win',
      bullet: 'x',
      powder: 'demo-powder-dp40',
      charge: 2,
      velocity: 800,
      muzzleDistance: 5,
    }
    const at = (bullet: object) => {
      own.bullets.set('x', { ...demo, ...bullet })
      return atMuzzle(row, own)
    }
    const g1 = demo.ballisticCoefficients?.filter((c) => c.dragModel === 'G1') ?? []
    expect(at({ ballisticCoefficients: g1 })).toHaveProperty('printedVelocity', 800)
    expect(at({ ballisticCoefficients: [...g1, ...g1] })).toEqual({ reason: 'noBulletDrag' })
    expect(at({ diameter: undefined })).toEqual({ reason: 'noBulletDrag' })
    expect(atMuzzle({ ...row, muzzleDistance: 0 }, own)).toEqual({ ...row, muzzleDistance: 0 })
  })

  it('makes no stand-in without the cartridge G1 and takes a short barrel for a short case', () => {
    const own = loadRecords(recordRoots)
    const short = [...own.cartridges.values()].find((c) =>
      c.values.some((v) => v.symbol === 'L3' && v.side === 'cartridge' && (v.value ?? 99) <= 33),
    )
    if (!short) throw new Error('no short case')
    const row: Row = {
      line: 1,
      cartridge: short.id,
      bullet: standInId('no-cartridge', 9),
      bulletMass: 9,
      powder: 'demo-powder-dp40',
      charge: 2,
      velocity: 800,
    }
    const [filled] = fillInputs(
      [
        { ...row, bullet: 'demo-bullet-168' },
        { ...row, cartridge: 'no-cartridge' },
      ],
      own,
    )
    expect(filled?.barrel).toBe(120)
    expect(own.bullets.has(standInId('no-cartridge', 9))).toBe(false)
  })

  it('compares two models on published rows', async () => {
    const folder = writeLoads([validation(), training()])
    const options = {
      rows: folder,
      records: recordRoots,
      split: 'validation',
      final: false,
    } as const
    const r = await compare(options, 'm3', 'm3')
    expect(r.published).toEqual({ files: 2, rows: 6, skipped: {} })
    expect(r.change.overall.velocityMedian).toBe(0)
    const io = { stdout: (_t: string) => {}, stderr: (_t: string) => {}, tty: false }
    let text = ''
    io.stdout = (t) => {
      text += t
    }
    const roots = recordRoots.flatMap((x) => ['--records', x])
    const args = ['compare', '--rows', folder, ...roots, '--baseline', 'm3', '--candidate', 'm3']
    expect(await run([...args, '--table'], {}, io)).toBe(0)
    expect(text).toContain('published loads: 2 files, 6 rows')
  })

  it('names the skipped charges in the table and leaves out the bases without a pressure', async () => {
    const folder = writeLoads([training(), customer()])
    let text = ''
    const io = {
      stdout: (t: string) => {
        text += t
      },
      stderr: (_t: string) => {},
      tty: true,
    }
    const roots = recordRoots.flatMap((x) => ['--records', x])
    expect(await run(['verify', '--rows', folder, ...roots, '--split', 'training'], {}, io)).toBe(0)
    expect(text).toContain('published loads: 2 files, 3 rows; skipped: customerTable 3')
    expect(text).not.toContain('pressure by basis')
  })
})
