/**
 * Golden numbers of the interior model with its optional features off, and with each feature
 * present at its neutral value (`golden/interior-neutral.json`).
 *
 * Tolerance: every number matches its stored value to a relative 1e-8 (a stored 0 must be 0
 * exactly). That is far above the last-digit difference between machines and below the effect of
 * a model constant changed by 1e-6 relative.
 *
 * Regenerate after an intended change of the model, and review the diff of the JSON file:
 *   UPDATE_GOLDEN=1 npx vitest run test/interior-golden.test.ts
 */
/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type InteriorLoad, type InteriorRun, interior } from '../src/index.ts'

const goldenUrl = new URL('golden/interior-neutral.json', import.meta.url)
const tolerance = 1e-8

/** 7-perforation grains, no resistance, heat loss, leakage or temperature sensitivity. */
const plain: InteriorLoad = {
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient: 7e-9,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
  },
  propellantTemperature: 300,
  ignitionPressure: 5e6,
  startPressure: 25e6,
}

const loads: Record<string, InteriorLoad> = {
  plain,
  'leakage with zero area': { ...plain, leakage: { area: [{ travel: 0, area: 0 }] } },
  'heat loss with factor 0': {
    ...plain,
    heat: { model: 'convective', flameTemperature: 2900, factor: 0 },
  },
  'bore resistance of 0 Pa': {
    ...plain,
    resistance: {
      friction: 0,
      engraving: [
        { travel: 0.001, pressure: 0 },
        { travel: 0.003, pressure: 0 },
      ],
    },
  },
  'temperature sensitivity of 0 per K': {
    ...plain,
    propellant: {
      ...plain.propellant,
      temperatureSensitivity: { reference: 294.15, cold: 0, hot: 0 },
    },
  },
}

/** The muzzle values and nine points of the curve, spaced evenly in index. */
function summary(run: InteriorRun) {
  const last = run.points.length - 1
  return {
    peakBreechPressure: run.peakBreechPressure,
    maxPressureTime: run.maxPressureTime,
    maxPressureTravel: run.maxPressureTravel,
    maxBasePressure: run.maxBasePressure,
    maxMeanPressure: run.maxMeanPressure,
    muzzleVelocity: run.muzzleVelocity,
    muzzleTime: run.muzzleTime,
    muzzleMeanPressure: run.muzzleMeanPressure,
    muzzleBasePressure: run.muzzleBasePressure,
    muzzleBreechPressure: run.muzzleBreechPressure,
    shotStartTime: run.shotStartTime,
    barrelTime: run.barrelTime,
    burnout: run.burnout,
    muzzleBurntFraction: run.muzzleBurntFraction,
    muzzleEnergy: run.muzzleEnergy,
    efficiency: run.efficiency,
    energy: run.energy,
    tenPercentPressureTime: run.tenPercentPressureTime,
    pointCount: run.points.length,
    points: Array.from({ length: 9 }, (_, i) => {
      const p = run.points[Math.round((i * last) / 8)]
      if (!p) throw new Error('curve without points')
      return {
        time: p.time,
        travel: p.travel,
        velocity: p.velocity,
        burntFraction: p.burntFraction,
        meanPressure: p.meanPressure,
        basePressure: p.basePressure,
        breechPressure: p.breechPressure,
        gasTemperature: p.gasTemperature,
      }
    }),
  }
}

function runs() {
  return Object.fromEntries(
    Object.entries(loads).map(([name, load]) => {
      const run = interior(load)
      if (!run.valid) throw new Error(`${name}: ${run.reason}`)
      return [name, summary(run)]
    }),
  )
}

/** Paths of every difference between the stored and the computed value, with the relative error of a number. */
function differences(stored: unknown, actual: unknown, path = ''): string[] {
  if (typeof stored === 'number' && typeof actual === 'number')
    return Math.abs(actual - stored) <= tolerance * Math.abs(stored)
      ? []
      : [`${path}: ${actual} against ${stored}`]
  if (
    stored === null ||
    actual === null ||
    typeof stored !== 'object' ||
    typeof actual !== 'object'
  )
    return stored === actual ? [] : [`${path}: ${actual} against ${stored}`]
  const a = actual as Record<string, unknown>
  const s = stored as Record<string, unknown>
  const keys = new Set([...Object.keys(s), ...Object.keys(a)])
  return [...keys].flatMap((k) => differences(s[k], a[k], `${path}/${k}`))
}

describe('interior model golden numbers', () => {
  if (process.env.UPDATE_GOLDEN === '1')
    writeFileSync(goldenUrl, `${JSON.stringify(runs(), null, 2)}\n`)
  const golden = JSON.parse(readFileSync(goldenUrl, 'utf8')) as Record<string, unknown>
  const computed = runs()

  it('stores one run per load', () => {
    expect(Object.keys(golden)).toEqual(Object.keys(loads))
  })

  it.each(Object.keys(loads))('%s matches its stored run', (name) => {
    expect(differences(golden[name], computed[name])).toEqual([])
  })
})
