import { canonicalNumberText, formatNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import type { InteriorResponse } from './api-types.ts'
import { toCsv } from './csv.ts'
import type { PlaybackSample } from './playback.ts'
import { formatQuantity, lengthText, type UnitSystem } from './units.ts'
import { percentOfPressureLimit, resultBand } from './workbench.ts'

type T = Translator['t']

/** A number as the page shows it, with the point a file and a spreadsheet read. */
const plain = (text: string) => canonicalNumberText(text)

/** A heading with its unit: "Breech pressure (psi)". */
const head = (name: string, unit: string) => (unit ? `${name} (${unit})` : name)

/**
 * The curves of a run as CSV, one row per time step of the result: time, travel, breech pressure,
 * velocity, bullet energy and burnt fraction, the units in the header and the decimals of the
 * chart's data table. `mass` is the bullet mass, kg.
 */
export function curvesCsv(
  points: readonly PlaybackSample[],
  mass: number,
  system: UnitSystem,
  t: T,
) {
  return toCsv([
    [
      head(t('Time'), 'ms'),
      head(t('Travel'), system.length.symbol),
      head(t('Breech pressure'), system.pressure.symbol),
      head(t('Velocity'), system.velocity.symbol),
      head(t('Energy'), system.energy.symbol),
      head(t('Burnt'), '%'),
    ],
    ...points.map((p) => [
      plain(formatNumber(p.time * 1e3, 3)),
      plain(lengthText('travel', system, p.travel)),
      plain(formatQuantity('pressure', system, p.breechPressure)),
      plain(formatQuantity('velocity', system, p.velocity)),
      plain(formatQuantity('energy', system, 0.5 * mass * p.velocity ** 2)),
      plain(formatNumber(p.burntFraction * 100, 1)),
    ]),
  ])
}

/**
 * The scalar results of a run as CSV: one row per value with its unit, the decimals of the
 * readouts. `charge` is the run's charge, kg.
 */
export function resultsCsv(body: InteriorResponse, charge: number, system: UnitSystem, t: T) {
  const r = body.result
  const range = body.pressureRange
  const band = resultBand(body)
  const ofMax = percentOfPressureLimit(r.peakBreechPressure, body.limits)
  const unit = (q: 'pressure' | 'velocity' | 'energy' | 'charge') => system[q].symbol
  const value = (q: 'pressure' | 'velocity' | 'energy' | 'charge', si: number) =>
    plain(formatQuantity(q, system, si))
  const ms = (s: number) => plain(formatNumber(s * 1e3, 3))
  const length = (m: number) => plain(lengthText('travel', system, m))
  const rows: (string | number)[][] = [
    [t('Charge'), value('charge', charge), unit('charge')],
    [t('Peak pressure'), value('pressure', range.nominalPressure), unit('pressure')],
    [t('Corner-case range, low'), value('pressure', range.lowPressure), unit('pressure')],
    [t('Corner-case range, high'), value('pressure', range.highPressure), unit('pressure')],
    ...(band.sampled
      ? [
          [t('5th percentile'), value('pressure', band.pressure.low), unit('pressure')],
          [t('95th percentile'), value('pressure', band.pressure.high), unit('pressure')],
        ]
      : []),
    ...(ofMax ? [[t('Percent of maximum'), plain(formatNumber(ofMax.percent, 0)), '%']] : []),
    [t('Peak pressure time'), ms(r.maxPressureTime), 'ms'],
    [t('Peak pressure travel'), length(r.maxPressureTravel), system.length.symbol],
    [t('Muzzle velocity'), value('velocity', r.muzzleVelocity), unit('velocity')],
    [t('Muzzle energy'), value('energy', r.muzzleEnergy), unit('energy')],
    [t('Muzzle pressure'), value('pressure', r.muzzleBreechPressure), unit('pressure')],
    [t('Barrel time'), ms(r.barrelTime), 'ms'],
    [t('Burnt at the muzzle'), plain(formatNumber(r.muzzleBurntFraction * 100, 1)), '%'],
    [
      t('Burnout at'),
      r.burnout ? length(r.burnout.travel) : t('no burnout in the barrel'),
      r.burnout ? system.length.symbol : '',
    ],
  ]
  return toCsv([[t('Quantity'), t('Value'), t('Unit')], ...rows])
}
