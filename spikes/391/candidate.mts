// A candidate interior model for `ballistics compare --candidate`: the M3 model of core with
// per-powder burn constants and an optional residual correction of the velocity, read from the
// local JSON file named by SPIKE391_PARAMS (fitted on training rows by fit.mts and analyse.py).
// A powder is found by its record vivacity and energy, the only identity a load carries.
import { readFileSync } from 'node:fs'
import { type InteriorLoad, interior as m3 } from '../../packages/core/dist/index.js'

interface Constants {
  viv: number
  energy?: number
  n?: number
  a?: number
  m?: number
}
interface Params {
  powders?: Record<string, Constants>
  /** ln(printed / model) = c0 + c1 ln(charge / bullet mass) + c2 ln(charge / chamber volume). */
  residual?: [number, number, number]
}

const path = process.env.SPIKE391_PARAMS
if (!path) throw new Error('SPIKE391_PARAMS names no parameter file')
const params = JSON.parse(readFileSync(path, 'utf8')) as Params

type Burn = Extract<InteriorLoad['propellant']['burn'], { kind: 'vivacity' }>

export function interior(load: InteriorLoad, options?: Parameters<typeof m3>[1]) {
  const burn = load.propellant.burn as Burn
  const x = params.powders?.[`${burn.vivacity}|${load.propellant.specificEnergy}`]
  const form = burn.form as Extract<Burn['form'], { kind: 'twoStage' }>
  const run = x
    ? ({
        ...load,
        propellant: {
          ...load.propellant,
          specificEnergy: load.propellant.specificEnergy * (x.energy ?? 1),
          burn: {
            ...burn,
            vivacity: burn.vivacity * x.viv,
            exponent: x.n ?? burn.exponent,
            form: { ...form, a: x.a ?? form.a, m: x.m ?? form.m },
          },
        },
      } as InteriorLoad)
    : load
  const result = m3(run, options)
  const c = params.residual
  if (!c || !result.valid) return result
  const f = Math.exp(
    c[0] +
      c[1] * Math.log(load.charge / load.bullet.mass) +
      c[2] * Math.log(load.charge / load.chamber.volume),
  )
  return { ...result, muzzleVelocity: result.muzzleVelocity * f }
}
