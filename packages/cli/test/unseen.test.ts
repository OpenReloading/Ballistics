import { interior } from '@open-reloading/core'
import type { Powder } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { verify } from '../src/commands.ts'
import { Refusal } from '../src/errors.ts'
import { predict } from '../src/evaluate.ts'
import { loadModel } from '../src/model.ts'
import type { Row } from '../src/rows.ts'
import { percentile } from '../src/stats.ts'
import { unseenPowder } from '../src/unseen.ts'
import { recordRoots, records, rowsCsv, writeRows } from './fixture.ts'

const powder = (id: string) => records.powders.get(`demo-powder-${id}`) as Powder

describe('unseenPowder', () => {
  it('takes the median of the fitted fields of its family and keeps its fixed inputs', () => {
    const sp25 = powder('sp25')
    const unseen = unseenPowder(
      {
        ...sp25, // the fixture record has interior parameters
        interior: { ...(sp25.interior as NonNullable<Powder['interior']>), gamma: 1.3 },
      },
      [powder('sp20'), powder('sp21'), powder('sp25'), powder('dp40')],
    )
    // sp20 and sp21 are the family; sp25 itself is left out
    expect(unseen?.interior?.vivacity).toEqual({ value: 0.5 })
    expect(unseen?.interior?.energy).toEqual({ value: 3.7e6 })
    expect(unseen?.interior?.gamma).toBe(1.3)
  })

  it('takes every other powder when its family has none', () => {
    const unseen = unseenPowder(powder('dp40'), [powder('sp20'), powder('sp25'), powder('dp40')])
    expect(unseen?.interior?.vivacity.value).toBeCloseTo(0.55, 12)
    expect(unseen?.interior?.burnForm).toEqual(powder('dp40').interior?.burnForm)
  })

  it('has none without interior parameters or without another powder', () => {
    expect(unseenPowder(powder('plain'), [powder('sp20')])).toBeUndefined()
    expect(unseenPowder(powder('sp20'), [powder('sp20'), powder('plain')])).toBeUndefined()
  })
})

describe('verify --leave-one-powder-out', () => {
  // validation cartridge 308-win; sp20, sp21 and sp22 share their fitted values, sp25 is faster
  const specs = [
    { cartridge: '308-win', powder: 'demo-powder-sp20', charge: 2.4, velocity: 0.03 },
    { cartridge: '308-win', powder: 'demo-powder-sp21', charge: 2.4, velocity: -0.04 },
    { cartridge: '308-win', powder: 'demo-powder-sp22', charge: 2.0, velocity: 0.01 },
    { cartridge: '308-win', powder: 'demo-powder-sp25', charge: 2.4, velocity: 0 },
    { cartridge: '308-win', powder: 'demo-powder-plain', charge: 2.0, velocity: 0 },
    { cartridge: '30-br', powder: 'demo-powder-sp20', charge: 2.0, velocity: 0.05 },
  ]
  const options = {
    rows: writeRows(rowsCsv(specs)),
    records: recordRoots,
    split: 'validation',
    final: false,
    leaveOnePowderOut: true,
  } as const
  const row = (p: string): Row => ({
    line: 0,
    cartridge: '308-win',
    bullet: 'demo-bullet-168',
    powder: `demo-powder-${p}`,
    charge: 2.4,
    velocity: 0,
    barrel: 600,
  })
  const velocity = (p: string) => {
    const r = predict(row(p), records, interior)
    return 'velocity' in r ? r.velocity : Number.NaN
  }

  it('predicts each powder from the others of its family, with a known error', async () => {
    const r = await verify(options)
    // left out, sp25 runs at the vivacity of its family, that is as sp20 does
    const sp25 = Math.abs(velocity('sp20') - velocity('sp25')) / velocity('sp25')
    expect(sp25).toBeGreaterThan(0.01)
    const errors = [0.03, 0.04, 0.01, sp25]
    const line = r.notInFittedSet
    expect(line?.powders).toBe(4)
    expect(line?.rows).toEqual({ inSplit: 4, used: 4, notUsed: {} })
    expect(line?.velocity?.median).toBeCloseTo(percentile(errors, 0.5) as number, 9)
    expect(line?.velocity?.p90).toBeCloseTo(percentile(errors, 0.9) as number, 9)
    expect(line?.interval).not.toBeNull()
  })

  it('has no line without the option and keeps the model version', async () => {
    const r = await verify({ ...options, leaveOnePowderOut: false })
    expect(r.notInFittedSet).toBeUndefined()
    expect(r.modelVersion).toBe((await verify(options)).modelVersion)
  })

  it('keeps the test split sealed', async () => {
    await expect(verify({ ...options, split: 'test' })).rejects.toThrow(Refusal)
  })

  it('puts the estimator into the model version', async () => {
    const model = await loadModel('m3')
    expect(model.files.map((f) => f.label)).toContain('cli/unseen.ts')
  })
})
