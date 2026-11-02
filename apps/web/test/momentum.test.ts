import { freeRecoil } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { momentumParts, momentumText, momentumUnit } from '../src/lib/momentum.ts'
import { presetUnits } from '../src/lib/units.ts'

describe('the momentum of the free recoil', () => {
  const input = {
    firearmMass: 4,
    projectileMass: 0.0109,
    chargeMass: 0.0026,
    muzzleVelocity: 800,
    gasFactor: 1.75,
  }
  const recoil = freeRecoil(input)
  const parts = momentumParts(recoil, input.projectileMass, input.muzzleVelocity)

  it('splits FreeRecoil.momentum into the bullet and the gas', () => {
    expect(parts.total).toBe(recoil.momentum)
    expect(parts.bullet).toBeCloseTo(8.72, 10)
    expect(parts.gas).toBeCloseTo(3.64, 10)
    expect(parts.bullet + parts.gas).toBeCloseTo(recoil.momentum, 12)
  })

  it('is in N·s beside joules and in lbf·s beside foot-pounds', () => {
    expect(momentumUnit(presetUnits('metric-grams')).symbol).toBe('N·s')
    expect(momentumText(presetUnits('metric-grams'), parts.total)).toBe('12.36')
    expect(momentumUnit(presetUnits('us')).symbol).toBe('lbf·s')
    // 1 lbf = 4.4482216152605 N (NIST SP 811)
    expect(momentumText(presetUnits('us'), parts.total)).toBe((12.36 / 4.4482216152605).toFixed(2))
  })
})
