import { loadRatio } from '@openreloading/core'
import { fromSi } from '@openreloading/schema'
import type { ErrorBody, InteriorLadderResponse, InteriorResponse } from '../lib/api-types.ts'
import { pagesBasePath } from '../lib/edition.ts'
import type { InteriorBody } from '../lib/interior-input.ts'
import type {
  LadderDirection,
  RunnableLadderKind,
  SeatingLengthKind,
  SeatingStep,
} from '../lib/seating-ladder.ts'
import { formatNumber, type UnitSystem, withUnit } from '../lib/units.ts'
import {
  bulletLeadTime,
  percentOfPressureLimit,
  shownWarnings,
  solidFillWarning,
  stepLabel,
  warningCountText,
} from '../lib/workbench.ts'
import type { Seated } from './seating-preview.tsx'

/** Interior fields that follow the seated bullet. */
export const previewKeys = ['volume', 'travel'] as const
export type PreviewKey = (typeof previewKeys)[number]
export const isPreviewKey = (key: string): key is PreviewKey =>
  (previewKeys as readonly string[]).includes(key)

/** A ladder step of a run: its answer, or the error of a result the model reports as invalid. */
export type Step = {
  charge: number
  body?: InteriorResponse
  error?: { message: string; reason?: string }
  /** A seating ladder's step: the length the bullet is seated by and what follows from it. */
  seating?: SeatingStep
  /** A temperature ladder's step: the propellant temperature, K. */
  temperature?: number
}

/**
 * The run's load at step `s`: its charge, with a seating ladder its volume and travel, with a
 * temperature ladder its propellant temperature.
 */
export const stepLoad = (load: InteriorBody['load'], s: Step): InteriorBody['load'] => ({
  ...load,
  charge: s.charge,
  ...(s.temperature !== undefined && { propellantTemperature: s.temperature }),
  ...(s.seating && {
    chamber: { ...load.chamber, volume: s.seating.volume },
    barrel: { ...load.barrel, length: s.seating.travel },
  }),
})

export type Outcome =
  | {
      kind: 'ok'
      /** The answer of the selected step. */
      body: InteriorResponse
      load: InteriorBody['load']
      at: string
      /** Run number: a new result starts the chart's playback afresh. */
      id: number
      /** Bulk density of the powder record at the run, kg/m³. */
      bulkDensity: number | undefined
      /** A powder record was chosen at the run. */
      powderChosen: boolean
      /** The record's bore-resistance law the run could not apply, with what was missing. */
      resistanceMissing?: { powder: string; missing: string[] }
      /** The user bullet design whose mass the run used. */
      design?: string
      /** The user cartridge design whose values the run's fields took. */
      cartridgeDesign?: string
      /** Id of the cartridge record the run compared its limits with. */
      cartridge?: string
      /** Cartridge, bullet and powder of the run, as their records name them. */
      identity: { cartridge?: string; bullet?: string; powder?: string }
      /** Inputs the prints show that the load does not carry, at the run: the seating and the firearm. */
      printed: {
        seated: Seated
        firearm?: string
        /** Gun weight at the run, kg; the free recoil readout needs it. */
        firearmMass?: number
        /** Gas velocity over muzzle velocity of the run's cartridge class (`apps/docs/docs/models/free-recoil.md`). */
        gasFactor: number
        /** Why a cartridge with a record id got the rifle factor without a CIP table. */
        gasFactorNote?: string
        /** Volume or travel held the seated bullet's value. */
        fromSeating: PreviewKey[]
      }
      /** The run returned a warning the one before did not: the warnings block is an alert. */
      announce: boolean
      /** Every step of the run in ladder order; one without a ladder. */
      steps: Step[]
      /** The step `body` and `load.charge` show. */
      selected: number
      /** The ladder's direction, which places the main charge among the steps. */
      direction: LadderDirection
      /** What the ladder varies; a seating ladder seats the bullet by `seatingBy`. */
      ladder: { kind: RunnableLadderKind; seatingBy?: SeatingLengthKind }
    }
  | {
      kind: 'error'
      status: number
      body: ErrorBody | undefined
      retryAfter: string | null
      /** The run failed while the browser reported no network. */
      offline?: boolean
    }

export const notReached = 'The API is unreachable.'
export const needsNetwork =
  pagesBasePath === undefined
    ? 'Needs the network: the interior simulation runs on the server.'
    : 'Simulations run in this browser. Offline use requires the needed records to be cached.'

/**
 * The barrel strip's figure at the shown step: a seating ladder's step seats the bullet at its own
 * depth, so its base is the barrel less the step's travel (mm), as the Barrel length study reads it.
 */
export function stripFigureOf(ok: Extract<Outcome, { kind: 'ok' }>) {
  const { figure, barrel } = ok.printed.seated
  const travel = ok.load.barrel.length
  if (ok.ladder.kind !== 'seating' || !figure || barrel === undefined || travel === undefined)
    return figure
  return { ...figure, base: fromSi('length', barrel - travel) }
}

/**
 * A seating or temperature ladder varies one thing at one charge, so what follows the charge (the
 * longer barrel run, the measured strings, the groups) reads the shown step alone.
 */
export const singleCharge = (ok: Extract<Outcome, { kind: 'ok' }> | undefined) =>
  ok !== undefined && ok.ladder.kind !== 'charge'

/** What a result's derived values and flag read; the Powders tab builds it per powder. */
type Shown = Pick<
  Extract<Outcome, { kind: 'ok' }>,
  'body' | 'load' | 'bulkDensity' | 'resistanceMissing'
>

/** A result's derived values. */
export function derived(ok: Shown) {
  const r = ok.body.result
  const { charge, chamber, propellant } = ok.load
  const ratio = loadRatio(charge, ok.bulkDensity, chamber.volume)
  const fill = solidFillWarning(charge, propellant.density, ok.bulkDensity, chamber.volume)
  /** The warnings the page adds to the API's, with their short names. */
  const own = [
    ...(ok.resistanceMissing
      ? [
          {
            text: `Simulation: the parameters of ${ok.resistanceMissing.powder} were fitted with a bore-resistance law this run cannot apply (missing: ${ok.resistanceMissing.missing.join(', ')}); the results are biased.`,
            name: 'bore resistance not applied',
          },
        ]
      : []),
    ...(fill ? [fill] : []),
  ]
  return {
    ofMax: percentOfPressureLimit(r.peakBreechPressure, ok.body.limits),
    lead: bulletLeadTime(r),
    ratio,
    fill,
    own,
    warnings: [...ok.body.warnings.map((w) => w.message), ...own.map((w) => w.text)],
  }
}

/** The warnings of the shown step as the page shows them: in its pressure unit, with short names. */
export function warningLines(ok: Extract<Outcome, { kind: 'ok' }>, system: UnitSystem) {
  return [...shownWarnings(ok.body, system), ...derived(ok).own]
}

/** The summary line of the warnings: their count, the step of a ladder and their names. */
export function warningsLine(ok: Extract<Outcome, { kind: 'ok' }>, lines: { name?: string }[]) {
  const names = lines.flatMap((l) => (l.name ? [l.name] : []))
  const step = ok.steps.length > 1 ? ` for step ${selectedLabel(ok)}` : ''
  return `${warningCountText(lines.length)}${step}${names.length > 0 ? `: ${names.join(', ')}` : ''}`
}

/**
 * The shown step's peak, percent of its limit and muzzle velocity, as the status says them after a
 * run and a step change.
 */
export function resultLine(ok: Extract<Outcome, { kind: 'ok' }>, system: UnitSystem) {
  const p = (pa: number) => withUnit('pressure', system, pa)
  const { ofMax } = derived(ok)
  const values = [
    `peak ${p(ok.body.pressureRange.nominalPressure)}`,
    ...(ofMax?.limit.pressure
      ? [
          `${formatNumber(ofMax.percent, 0)} % of CIP ${ofMax.limit.symbol} ${p(ofMax.limit.pressure)}`,
        ]
      : []),
    withUnit('velocity', system, ok.body.result.muzzleVelocity),
  ].join(', ')
  if (ok.steps.length < 2) return `${values.replace(/^p/, 'P')}.`
  const { seating, temperature } = ok.steps[ok.selected] ?? {}
  const at = seating
    ? withUnit('length', system, seating.value)
    : temperature !== undefined
      ? withUnit('temperature', system, temperature)
      : withUnit('charge', system, ok.load.charge)
  return `Step ${selectedLabel(ok)}, ${at}: ${values}.`
}

/** The shown step's label relative to the main charge. */
export const selectedLabel = (ok: Extract<Outcome, { kind: 'ok' }>) =>
  stepLabel(ok.selected, ok.steps.length, ok.direction)

/** Warning codes that flag a step as outside the model; the others are about limits. */
const modelCodes = ['rangeIncomplete', 'chargeTooSmall']

/** The flag of a step, worded as a simulation result. */
export function stepFlag(ok: Shown) {
  const { limits, warnings } = ok.body
  // exceeded: the upper end of the pressure range; nominalExceeded: the peak itself. The flag names
  // its maximum
  const name = (l: NonNullable<typeof limits>[number]) => `CIP ${l.symbol}`
  const peak = limits?.find((l) => l.nominalExceeded)
  if (peak) return `above ${name(peak)}`
  const range = limits?.find((l) => l.exceeded)
  if (range) return `range above ${name(range)}`
  if (warnings.some((w) => modelCodes.includes(w.code)) || derived(ok).fill) return 'model flag'
  return
}

/** The outcome showing step `i`. */
export function atStep(ok: Extract<Outcome, { kind: 'ok' }>, i: number) {
  const s = ok.steps[i]
  return { ...ok, body: s.body ?? ok.body, load: stepLoad(ok.load, s), selected: i }
}

/** The steps of an answer: a ladder's, or the single result as step 1. */
export function stepsOf(json: InteriorResponse | InteriorLadderResponse, charge: number): Step[] {
  if (!('ladderSteps' in json)) return [{ charge, body: json }]
  const { ladderSteps, ...shared } = json
  return ladderSteps.map((s) =>
    'error' in s
      ? { charge: s.charge, error: s.error }
      : { charge: s.charge, body: { ...shared, ...s } },
  )
}

/** The load ratio as case fill, the reloader's word: percent of the free volume. */
export function loadRatioText(ok: Extract<Outcome, { kind: 'ok' }> | undefined, ratio?: number) {
  if (ratio !== undefined) return `${formatNumber(ratio * 100, 0)} %`
  if (!ok?.powderChosen) return 'needs a powder record'
  if (!ok.bulkDensity) return 'needs bulk density'
  return 'needs a chamber volume'
}

/** Each step as the readouts show it, with its flag. */
export function shownSteps(ok: Extract<Outcome, { kind: 'ok' }> | undefined) {
  return (ok?.steps ?? []).map((s, i) => {
    const at = ok && s.body ? atStep(ok, i) : undefined
    // `n` keeps the order the selection uses; `label` is what the page shows
    const label = stepLabel(i, ok?.steps.length ?? 1, ok?.direction ?? 'up')
    return { ...s, n: i + 1, label, at, d: at && derived(at), flag: at ? stepFlag(at) : undefined }
  })
}
export type ShownStep = ReturnType<typeof shownSteps>[number]
