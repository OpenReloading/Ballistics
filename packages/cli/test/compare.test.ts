import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compare, verify } from '../src/commands.ts'
import { Refusal, UsageError } from '../src/errors.ts'
import { loadModel } from '../src/model.ts'
import { rowsPath } from './data.ts'
import { recordRoots, rowsCsv, writeRows } from './fixture.ts'

const options = { rows: rowsPath, records: recordRoots, split: 'validation', final: false } as const
const worse = new URL('./fixtures/worse-model.mjs', import.meta.url).pathname

describe('compare', () => {
  it('reports no change for a model against itself', async () => {
    const r = await compare(options, 'm3', 'm3')
    const zero = {
      usedRows: 0,
      velocityMedian: 0,
      velocityP90: 0,
      pressureMedian: 0,
      pressureP90: 0,
      intervalCoverage: 0,
    }
    expect(r.change.overall).toEqual(zero)
    // a family without a printed pressure has none to compare
    for (const change of Object.values(r.change.byFamily))
      expect(Object.values(change).every((v) => v === 0 || v === null)).toBe(true)
    expect(Object.values(r.change.byFamily).map((c) => c.velocityMedian)).toEqual([
      0,
      0,
      null,
      null,
    ])
    expect(r.baseline.modelVersion).toBe(r.candidate.modelVersion)
  })

  it('reports the sign of the change of a model that is 10 % too fast', async () => {
    const r = await compare(options, 'm3', worse)
    // the median error moves from 0.03 to 0.1 + 1.1 * 0.01
    expect(r.change.overall.velocityMedian).toBeCloseTo(0.111 - 0.03, 9)
    expect(r.change.overall.velocityP90).toBeGreaterThan(0)
    expect(r.change.overall.pressureMedian).not.toBeNull()
    expect(r.change.byFamily['double/extruded']?.velocityMedian).toBeGreaterThan(0)
    expect(r.candidate.modelVersion).not.toBe(r.baseline.modelVersion)
    expect(r.candidate.model).toBe(worse)
  })

  it('adds the change per group of --group-by when both sides have it', async () => {
    const r = await compare({ ...options, groupBy: 'cartridge' }, 'm3', worse)
    expect(r.change.grouped?.['30-30-win']?.velocityMedian).toBeGreaterThan(0)
    const saved = writeRows(JSON.stringify(await verify(options)), 'baseline.json')
    expect(
      (await compare({ ...options, groupBy: 'cartridge' }, saved, worse)).change.grouped,
    ).toBeUndefined()
  })

  it('takes a saved verify result as the baseline', async () => {
    const saved = writeRows(JSON.stringify(await verify(options)), 'baseline.json')
    const r = await compare(options, saved, worse)
    expect(r.baseline.model).toBe('m3')
    expect(r.change.overall.velocityMedian).toBeCloseTo(0.111 - 0.03, 9)
  })

  it('refuses a baseline of another split, other rows or no verify result', async () => {
    const training = writeRows(
      JSON.stringify(await verify({ ...options, split: 'training' })),
      'b.json',
    )
    await expect(compare(options, training, 'm3')).rejects.toThrow(
      /training result, this run is validation/,
    )
    const saved = writeRows(JSON.stringify(await verify(options)), 'baseline.json')
    const otherRows = writeRows(
      rowsCsv([
        { cartridge: '308-win', charge: 2.0, velocity: 0.02 },
        { cartridge: '30-br', charge: 2.0, velocity: 0.02 },
      ]),
    )
    await expect(compare({ ...options, rows: otherRows }, saved, 'm3')).rejects.toThrow(Refusal)
    const broken = writeRows('{', 'broken.json')
    await expect(compare(options, broken, 'm3')).rejects.toThrow(UsageError)
    const notResult = writeRows('{"a":1}', 'a.json')
    await expect(compare(options, notResult, 'm3')).rejects.toThrow('not a verify result')
  })

  it('needs --final for the test split', async () => {
    await expect(compare({ ...options, split: 'test' }, 'm3', 'm3')).rejects.toThrow(Refusal)
    const r = await compare({ ...options, split: 'test', final: true }, 'm3', 'm3')
    expect(r.final).toBe(true)
  })

  it('refuses a model module that is missing, has no interior or does not load', async () => {
    const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname
    await expect(compare(options, 'm3', '/nonexistent/m.mjs')).rejects.toThrow(
      'neither "m3" nor a file',
    )
    await expect(
      compare(options, 'm3', new URL('./fixtures/no-model.mjs', import.meta.url).pathname),
    ).rejects.toThrow('exports no function')
    await expect(
      compare(options, 'm3', new URL('./fixtures/broken-model.mjs', import.meta.url).pathname),
    ).rejects.toThrow('cannot be loaded')
    expect(fixture('x')).toContain('fixtures')
  })

  it('hashes the files a candidate module imports', async () => {
    const path = writeRows("export { interior } from './helper.mjs'\n", 'candidate.mjs')
    const helper = path.replace('candidate.mjs', 'helper.mjs')
    writeFileSync(helper, "export { interior } from '@open-reloading/core'\n")
    const a = await verify(options, path)
    writeFileSync(helper, "export { interior } from '@open-reloading/core'\n// changed\n")
    expect((await verify(options, path)).modelVersion).not.toBe(a.modelVersion)
  })

  it('includes the files of the core model in a candidate version', async () => {
    const { files } = await loadModel(worse)
    expect(files.map((f) => f.label)).toContain('core/interior/model.js')
    expect(files.map((f) => f.label)).toContain('candidate/worse-model.mjs')
  })

  it('includes the water density and the unit and capacity code in every version', async () => {
    const labels = (await loadModel('m3')).files.map((f) => f.label)
    expect(labels).toEqual(
      expect.arrayContaining(['core/water.js', 'schema/units.js', 'schema/case-capacity.js']),
    )
  })
})
