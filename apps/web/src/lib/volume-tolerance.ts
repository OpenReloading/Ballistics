import { type Message, msg } from '../i18n/translate.ts'
import { maxVolumeFraction } from './workbench.ts'

/**
 * The pressure range's tolerance of the chamber volume from where the case capacity comes from
 * (`apps/docs/docs/models/case-capacity.md`, "Tolerance of the volume"): relative fractions of the
 * capacity, 1.
 */
export const capacityTolerance = Object.freeze({
  /** A measured capacity without its spread: assumption, half the former flat 1 %. */
  measured: 0.005,
  /**
   * A catalogue or case record capacity of one maker: assumption without a published source; a
   * between-maker spread of about 1 % SD (.308, four makers, a magazine chart quoted in a forum) is
   * unverified.
   */
  catalogue: 0.02,
})

/** The rule a capacity's tolerance follows, as the range's help names it. */
export type CapacityRule = 'spread' | 'measured' | 'makers' | 'catalogue'

export const capacityRuleText: Record<CapacityRule, Message> = {
  spread: msg('the spread of your measured cases over their capacity'),
  measured: msg('a measured capacity without its spread, 0.5 % assumed'),
  makers: msg('the spread of the capacity records of different makers over their mean'),
  catalogue: msg('a catalogue capacity of one maker, 2 % assumed without a published source'),
}

/** A capacity record of the cartridge as the catalogue lists it: water (g) and the case's maker. */
type Recorded = { waterCapacity: { value: number }; caseManufacturer?: string | undefined }

/**
 * The tolerance of a capacity, relative to it, with its rule: a measured one with its spread
 * (standard deviation, g) as spread over capacity, without one 0.5 %; a record's as the standard
 * deviation over the mean of the cartridge's capacity records of two or more makers, else 2 %.
 */
export function capacityFraction(a: {
  source: 'measured' | 'capacity' | 'case'
  grams: number
  spread?: number | undefined
  records: readonly Recorded[]
}): { fraction: number; rule: CapacityRule } {
  if (a.source === 'measured')
    return a.spread !== undefined && a.spread > 0
      ? { fraction: a.spread / a.grams, rule: 'spread' }
      : { fraction: capacityTolerance.measured, rule: 'measured' }
  const made = a.records.filter((r) => r.caseManufacturer !== undefined)
  if (new Set(made.map((r) => r.caseManufacturer)).size >= 2) {
    const values = made.map((r) => r.waterCapacity.value)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
    const fraction = Math.sqrt(variance) / mean
    // records that agree exactly say nothing about the spread: the default stays
    if (fraction > 0) return { fraction, rule: 'makers' }
  }
  return { fraction: capacityTolerance.catalogue, rule: 'catalogue' }
}

/**
 * The run's tolerance of the volume behind the bullet, relative to it: the capacity's tolerance
 * moves the case volume (m3) by `fraction` of it, the bullet's length interval (`bullet`, relative
 * to the volume, from an estimated bullet volume) adds to it; at most the API's limit.
 */
export function volumeFraction(a: {
  capacity: { fraction: number } | undefined
  caseVolume: number | undefined
  volume: number
  bullet?: number | undefined
}): number | undefined {
  const fromCapacity =
    a.capacity && a.caseVolume !== undefined ? (a.capacity.fraction * a.caseVolume) / a.volume : 0
  const sum = fromCapacity + (a.bullet ?? 0)
  return sum > 0 ? Math.min(sum, maxVolumeFraction) : undefined
}
