import { castHarderThanPeak, coldPeakInterval, loadRatio } from '@open-reloading/core'
import { fromSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import type { ErrorBody, InteriorLadderResponse, InteriorResponse } from '../lib/api-types.ts'
import type { InteriorBody } from '../lib/interior-input.ts'
import { nth } from '../lib/nth.ts'
import { rawWording } from '../lib/record-values.ts'
import type {
  LadderDirection,
  RunnableLadderKind,
  SeatingLengthKind,
  SeatingStep,
} from '../lib/seating-ladder.ts'
import { formatQuantity, type UnitSystem, withUnit } from '../lib/units.ts'
import { say } from '../lib/wording.ts'
import {
  bandLine,
  bulletLeadTime,
  percentOfPressureLimit,
  shownWarnings,
  solidFillWarning,
  stepLabel,
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
  error?: { message: string; reason?: string | undefined }
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
      resistanceMissing?: { powder: string; missing: string[] } | undefined
      /** Brinell hardness of the bullet record when it is cast with a plain base (`plainBaseCastHardness`). */
      castHardness?: number | undefined
      /** Rounds fired through the chosen firearm's barrel, its record's `roundCount`. */
      roundCount?: number | undefined
      /**
       * The powder record has no temperature coefficient and the run took the default of its grain
       * form; `coldPeak`: the peak breech pressure over the cold sensitivity interval, Pa, below the reference.
       */
      sensitivityDefault?:
        | {
            form: string
            /** The cold sensitivity interval of the default, 1/K. */
            coldInterval: readonly [number, number]
            coldPeak?: [number, number] | undefined
          }
        | undefined
      /** The user bullet design whose mass the run used. */
      design?: string | undefined
      /** The user cartridge design whose values the run's fields took. */
      cartridgeDesign?: string | undefined
      /** The run's chamber volume is a measured case capacity (`volumeMeasured`), not an estimate. */
      volumeMeasured: boolean
      /** The user powder design whose model parameters the run's fields took. */
      powderDesign?: string | undefined
      /** The chosen cartridge's name when the powder record lists other cartridges only. */
      unlisted?: string | undefined
      /** Id of the cartridge record the run compared its limits with. */
      cartridge?: string | undefined
      /** Cartridge, bullet and powder of the run, as their records name them. */
      identity: {
        cartridge?: string | undefined
        bullet?: string | undefined
        powder?: string | undefined
      }
      /** Inputs the prints show that the load does not carry, at the run: the seating and the firearm. */
      printed: {
        seated: Seated
        firearm?: string | undefined
        /** Gun weight at the run, kg; the free recoil readout needs it. */
        firearmMass?: number | undefined
        /** Gas velocity over muzzle velocity of the run's cartridge class (`apps/docs/docs/models/free-recoil.md`). */
        gasFactor: number
        /** Why a cartridge with a record id got the rifle factor without a CIP table. */
        gasFactorNote?: string | undefined
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
      ladder: { kind: RunnableLadderKind; seatingBy?: SeatingLengthKind | undefined }
    }
  | {
      kind: 'error'
      status: number
      body: ErrorBody | undefined
      retryAfter: string | null
      /** The run failed while the browser reported no network. */
      offline?: boolean
    }

/** The note of a run whose chamber volume is not a measured capacity: what is estimated and what to enter. */
const volumeNote = {
  title: msg('Chamber volume not measured'),
  text: msg(
    'The volume comes from a record or a typed value, and the peak pressure and muzzle velocity follow it. Enter a measured case capacity in the Cartridge card and empty the volume field to follow it.',
  ),
}

/** The note as one sentence pair for the prints, none when the run's volume is measured. */
export const volumeNoteText = (ok: { volumeMeasured: boolean } | undefined, t: Translator['t']) =>
  ok && !ok.volumeMeasured ? `${t(volumeNote.title)}: ${t(volumeNote.text)}` : undefined

export const notReached = msg(
  'A data file did not load or the computation failed. Check the connection and retry.',
)
export const needsNetwork = msg(
  'Simulations run in this browser. Offline use requires the needed records to be cached.',
)

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
  'body' | 'load' | 'bulkDensity' | 'resistanceMissing' | 'castHardness'
>

/** A result's derived values. */
export function derived(ok: Shown, t: Translator['t']) {
  const r = ok.body.result
  const { charge, chamber, propellant } = ok.load
  const ratio = loadRatio(charge, ok.bulkDensity, chamber.volume)
  const fill = solidFillWarning(charge, propellant.density, ok.bulkDensity, chamber.volume, t)
  /** The warnings the page adds to the API's, with their short names. */
  const own = [
    ...(ok.resistanceMissing
      ? [
          {
            text: t(
              'Simulation: the parameters of {name} were fitted with a bore-resistance law this run cannot apply (missing: {missing}); the results are biased.',
              {
                name: ok.resistanceMissing.powder,
                missing: ok.resistanceMissing.missing.join(', '),
              },
            ),
            name: t('bore resistance not applied'),
          },
        ]
      : []),
    ...(fill ? [fill] : []),
    ...(ok.castHardness !== undefined && castHarderThanPeak(ok.castHardness, r.peakBreechPressure)
      ? [
          {
            text: t(
              'The bullet is cast with a plain base, and its alloy is harder than the simulated peak pressure upsets by the rule of thumb: the base may not seal the bore, so gas may leak past it. The model does not include such a leak.',
            ),
            name: t('possible gas leakage'),
          },
        ]
      : []),
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

/** The warnings of a result as one text, the unlisted cartridge's among them; empty without any. */
export const warningsText = (ok: Extract<Outcome, { kind: 'ok' }>, t: Translator['t']) =>
  [...derived(ok, t).warnings, ...(ok.unlisted ? [ok.unlisted] : [])].join('\n')

/** The warnings of the shown step as the page shows them: in its pressure unit, with short names. */
export function warningLines(
  ok: Extract<Outcome, { kind: 'ok' }>,
  system: UnitSystem,
  t: Translator['t'],
) {
  return [...shownWarnings(ok.body, system, t), ...derived(ok, t).own]
}

/**
 * The cartridge's name when the powder record lists the cartridges its manufacturer names and this
 * one is not among them; a powder without a list says nothing.
 */
export const unlistedCartridge = (
  powder: { listedCartridges?: string[] | undefined } | undefined,
  cartridge: { id: string; name: string } | undefined,
) =>
  cartridge && powder?.listedCartridges && !powder.listedCartridges.includes(cartridge.id)
    ? cartridge.name
    : undefined

/** The kinds of a result note in their order: limits and model flags, what is missing, how a value is meant. */
export const noteKinds = ['warning', 'message', 'note'] as const
export type NoteKind = (typeof noteKinds)[number]

/** One entry of the result's notes: its line, and the full reason with what clears it where the line is short. */
export type ResultNote = { kind: NoteKind; line: string; text?: string | undefined }

/** What clears a missing case fill, by the reason `loadRatioText` gives. */
const fillActions = {
  powder: msg('Choose a powder record in the Powder card.'),
  density: msg('The powder record gives no bulk density. Choose a powder record that gives one.'),
  volume: msg('Enter the usable case volume in the Cartridge card.'),
}

/**
 * Everything the result panel says about the shown step, warnings first, then messages, then
 * notes, each in the order of its source.
 */
export function resultNotes(
  ok: Extract<Outcome, { kind: 'ok' }>,
  warnings: { text: string; name?: string | undefined }[],
  system: UnitSystem,
  t: Translator['t'],
): ResultNote[] {
  const { ratio } = derived(ok, t)
  const band = bandLine(ok.body, system, t)
  const fill = !ok.powderChosen ? 'powder' : !ok.bulkDensity ? 'density' : 'volume'
  const designs = [
    ok.cartridgeDesign &&
      t('Case values from the user design {name}, not a catalogue record.', {
        name: ok.cartridgeDesign,
      }),
    ok.powderDesign &&
      t('Powder values from the user design {name}, not a catalogue record.', {
        name: ok.powderDesign,
      }),
    ok.design &&
      t('Computed with the bullet mass of the user design {name}, not a catalogue record.', {
        name: ok.design,
      }),
  ]
  const notes: ResultNote[] = [
    ...warnings.map((w) => ({
      kind: 'warning' as const,
      line: w.name ?? w.text,
      text: w.name ? w.text : undefined,
    })),
    ...(ok.unlisted
      ? [
          {
            kind: 'warning' as const,
            line: t(
              '{cartridge} is not among the cartridges the manufacturer lists this powder for.',
              {
                cartridge: ok.unlisted,
              },
            ),
          },
        ]
      : []),
    ...(ok.volumeMeasured
      ? []
      : [{ kind: 'message' as const, line: t(volumeNote.title), text: t(volumeNote.text) }]),
    ...(ratio === undefined
      ? [
          {
            kind: 'message' as const,
            line: `${t('Case fill')}: ${loadRatioText(ok, ratio, t)}`,
            text: t(fillActions[fill]),
          },
        ]
      : []),
    ...designs.flatMap((line) => (line ? [{ kind: 'note' as const, line }] : [])),
    ...(ok.sensitivityDefault
      ? [
          {
            kind: 'note' as const,
            line: t(
              'Default temperature coefficient of {form} powder: the powder record gives none.',
              {
                form: say(t, rawWording(ok.sensitivityDefault.form)),
              },
            ),
            text: t(
              'The burn rate follows the propellant temperature by a coefficient of the grain form, not of this powder (ball: measured burn rates; extruded and flake: a maker table through the model), with a wide interval. Results at another temperature than the reference are approximate.',
            ),
          },
          ...(ok.sensitivityDefault.coldPeak
            ? [
                {
                  kind: 'note' as const,
                  line: t(
                    'Cold side: peak pressure {low} to {high} with the default coefficient.',
                    {
                      low: formatQuantity('pressure', system, ok.sensitivityDefault.coldPeak[0]),
                      high: withUnit('pressure', system, ok.sensitivityDefault.coldPeak[1]),
                    },
                  ),
                  text: t(
                    'Below the reference temperature the default gives no single value of the peak pressure: measured cold changes of ball grains were not significant, so the cold coefficient spans 0 to 0.0030 per K.',
                  ),
                },
              ]
            : []),
        ]
      : []),
    ...(ok.roundCount && !ok.load.chamber.throatWear
      ? [
          {
            kind: 'note' as const,
            line: t(
              'The barrel has fired {count} rounds: the velocity may be lower than simulated.',
              {
                count: formatNumber(ok.roundCount, 0),
              },
            ),
            text: t(
              'A worn throat adds volume behind the bullet. One measured 5.56x45 mm barrel lost 0.29 % of its muzzle velocity per 1000 rounds up to 8000 rounds and 0.54 % per 1000 rounds from 8000 to 16000 (Vuong et al. 2026); rates do not carry over to other cartridges or firing. Enter a measured length in Throat wear of the Gun card.',
            ),
          },
        ]
      : []),
    ...(band ? [{ kind: 'note' as const, line: band }] : []),
  ]
  return noteKinds.flatMap((kind) => notes.filter((n) => n.kind === kind))
}

/**
 * The shown step's peak, percent of its limit and muzzle velocity, as the status says them after a
 * run and a step change.
 */
export function resultLine(
  ok: Extract<Outcome, { kind: 'ok' }>,
  system: UnitSystem,
  t: Translator['t'],
) {
  const p = (pa: number) => withUnit('pressure', system, pa)
  const { ofMax } = derived(ok, t)
  const single = ok.steps.length < 2
  const pressure = p(ok.body.pressureRange.nominalPressure)
  const values = [
    single ? t('Peak {pressure}', { pressure }) : t('peak {pressure}', { pressure }),
    ...(ofMax?.limit.pressure
      ? [
          t('{percent} % of CIP {symbol} {limit}', {
            percent: formatNumber(ofMax.percent, 0),
            symbol: ofMax.limit.symbol,
            limit: p(ofMax.limit.pressure),
          }),
        ]
      : []),
    withUnit('velocity', system, ok.body.result.muzzleVelocity),
  ].join(', ')
  if (single) return `${values}.`
  const { seating, temperature } = ok.steps[ok.selected] ?? {}
  const at = seating
    ? withUnit('length', system, seating.value)
    : temperature !== undefined
      ? withUnit('temperature', system, temperature)
      : withUnit('charge', system, ok.load.charge)
  return t('Step {step}, {at}: {values}.', { step: selectedLabel(ok), at, values })
}

/** The shown step's label relative to the main charge. */
export const selectedLabel = (ok: Extract<Outcome, { kind: 'ok' }>) =>
  stepLabel(ok.selected, ok.steps.length, ok.direction)

/** Warning codes that flag a step as outside the model; the others are about limits. */
const modelCodes = ['rangeIncomplete', 'chargeTooSmall']

/** The flag of a step, worded as a simulation result. */
export function stepFlag(ok: Shown, t: Translator['t']) {
  const { limits, warnings } = ok.body
  // exceeded: the upper end of the pressure range; nominalExceeded: the peak itself. The flag names
  // its maximum
  const name = (l: NonNullable<typeof limits>[number]) => `CIP ${l.symbol}`
  const peak = limits?.find((l) => l.nominalExceeded)
  if (peak) return t('above {name}', { name: name(peak) })
  const range = limits?.find((l) => l.exceeded)
  if (range) return t('range above {name}', { name: name(range) })
  if (warnings.some((w) => modelCodes.includes(w.code)) || derived(ok, t).fill)
    return t('model flag')
  return
}

/** The default sensitivity of a run with the cold-side peak interval of the load it shows (`coldPeakInterval`). */
export function withColdPeak(
  d: { form: string; coldInterval: readonly [number, number] } | undefined,
  load: InteriorBody['load'],
): Extract<Outcome, { kind: 'ok' }>['sensitivityDefault'] {
  return (
    d && {
      form: d.form,
      coldInterval: d.coldInterval,
      coldPeak: coldPeakInterval(load, d.coldInterval),
    }
  )
}

/** The outcome showing step `i`; the cold-side interval of a default sensitivity follows the step. */
export function atStep(ok: Extract<Outcome, { kind: 'ok' }>, i: number) {
  const s = nth(ok.steps, i)
  const load = stepLoad(ok.load, s)
  return {
    ...ok,
    body: s.body ?? ok.body,
    load,
    selected: i,
    sensitivityDefault: withColdPeak(ok.sensitivityDefault, load),
  }
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
export function loadRatioText(
  ok: Extract<Outcome, { kind: 'ok' }> | undefined,
  ratio: number | undefined,
  t: Translator['t'],
) {
  if (ratio !== undefined) return `${formatNumber(ratio * 100, 0)} %`
  if (!ok?.powderChosen) return t('needs a powder record')
  if (!ok.bulkDensity) return t('needs bulk density')
  return t('needs a chamber volume')
}

/** Each step as the readouts show it, with its flag. */
export function shownSteps(ok: Extract<Outcome, { kind: 'ok' }> | undefined, t: Translator['t']) {
  return (ok?.steps ?? []).map((s, i) => {
    const at = ok && s.body ? atStep(ok, i) : undefined
    // `n` keeps the order the selection uses; `label` is what the page shows
    const label = stepLabel(i, ok?.steps.length ?? 1, ok?.direction ?? 'up')
    return {
      ...s,
      n: i + 1,
      label,
      at,
      d: at && derived(at, t),
      flag: at ? stepFlag(at, t) : undefined,
    }
  })
}
export type ShownStep = ReturnType<typeof shownSteps>[number]
