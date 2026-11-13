/** `POST /interior/load-file`: an M3 run of the workbench load file, with the summary the workbench shows. */

import {
  advisoryRule,
  boreArea,
  cartridgeBoreAreaMm2,
  cartridgeBulletDiameterMm,
  cartridgeGrooveDiameterMm,
  cartridgeLandDiameterMm,
  fillLoadRatioLimit,
  type InteriorLoad,
  loadRatio,
  type PressureRange,
  type ResistanceGap,
  recordBoreArea,
  recordResistance,
  recordSensitivity,
  solidFill,
  solidFillLimit,
} from '@rangefoundry/ballistics'
import type { Catalogue } from '@rangefoundry/catalog'
import {
  type Bullet,
  fromSi,
  type Load,
  ladderStepKinds,
  type Powder,
  toSi,
  userDataFile,
} from '@rangefoundry/schema'
import { z } from 'zod'
import { resistanceGapText } from './advisory-text.ts'
import { assertFinite, notice, resolvedRecord, unprocessable } from './answer.ts'
import { powderBulkDensity } from './charge-run.ts'
import { runInterior } from './interior-run.ts'
import { type InteriorBody, interiorBody } from './interior-schema.ts'
import { InputError } from './issue.ts'
import { type CartridgeWithSpecs, type Warning, warning } from './limits.ts'
import {
  bulletLengthMm,
  catalogueIdOf,
  fileLoad,
  filePath,
  fileResistance,
  loadValues,
  missingValuesAnswer,
  type Path,
  readLoadFile,
  unknownKeyIssues,
} from './load-file.ts'
import { findBullet, findCartridge, findPowder } from './resolve.ts'
import type { ComputeRunner, Results } from './tasks.ts'
import { responseUnits } from './units.ts'

/** Query of `POST /interior/load-file`: the body is the load file, so the query is the only option. */
export const simulateQuery: z.ZodObject<
  { curves: z.ZodOptional<z.ZodEnum<{ true: 'true'; false: 'false' }>> },
  z.core.$strict
> = z.strictObject({
  curves: z
    .enum(['true', 'false'])
    .optional()
    .describe('`true` adds the time curves (`points`) of the shown run. Default `false`.'),
})

/** The body of `POST /interior/load-file` as the document shows it. The route reads it with `readLoadFile`. */
export const loadFileBody: typeof userDataFile = userDataFile
  .extend({
    records: userDataFile.shape.records.describe(
      'The records of the file. Exactly one is a workbench load (`kind` `load`). Its `charge` and the solver values it types under `data.analysis.overrides` are in stored units (g, mm, cm3, bar, degC).',
    ),
    files: userDataFile.shape.files.describe('Photos of target sheets, base64. Not read here.'),
  })
  .describe('A load file saved by the workbench.')

/** Units of the summary of `POST /interior/load-file`. */
const summaryUnits = {
  peakPressure: 'Pa',
  muzzleVelocity: 'm/s',
  muzzleEnergy: 'J',
  barrelTime: 's',
  loadRatio: '1',
  muzzleBurntFraction: '1',
} as const

/** A valid M3 result: the fields the summary of a simulation reads. */
type M3Result = Extract<Results['interiorM3']['result'], { valid: true }>
type SimulateStep = { charge: number } & (
  | { result: M3Result; pressureRange: PressureRange; limits?: unknown; warnings: Warning[] }
  | { error: { message: string; reason?: string } }
)
type ValidStep = Extract<SimulateStep, { result: unknown }>

/** The catalogue id a load names a bullet or powder by; none for a description. */
const recordIdOf = (target: string | object | undefined) =>
  typeof target === 'string' ? catalogueIdOf(target) : undefined

/** The powder and bullet records the file names that exist: the values the load leaves out come from them. */
function knownRecords(catalogue: Catalogue, record: Load) {
  const powderId = recordIdOf(record.powder)
  const bulletId = recordIdOf(record.bullet)
  return {
    powder: powderId === undefined ? undefined : catalogue.get('powder', powderId),
    bullet: bulletId === undefined ? undefined : catalogue.get('bullet', bulletId),
  }
}

/** The cartridge, bullet and powder records the file names, with the powder's label "<manufacturer name> <product name>"; 404 for an unknown id. */
function loadFileRecords(catalogue: Catalogue, record: Load) {
  const bulletId = recordIdOf(record.bullet)
  const powderId = recordIdOf(record.powder)
  const cartridge: CartridgeWithSpecs | undefined =
    record.cartridge === undefined
      ? undefined
      : findCartridge(catalogue, catalogueIdOf(record.cartridge))
  const bullet: Bullet | undefined =
    bulletId === undefined ? undefined : findBullet(catalogue, bulletId)
  const powder: Powder | undefined =
    powderId === undefined ? undefined : findPowder(catalogue, powderId)
  const manufacturer = powder && catalogue.get('manufacturer', powder.manufacturer)
  const powderLabel = powder && `${manufacturer?.name ?? powder.manufacturer} ${powder.name}`
  return { cartridge, bullet, powder, powderLabel }
}

/** What the summary of a step reads besides the step. */
type SummaryInputs = {
  /** Bulk density of the propellant, kg/m3. */
  bulkDensity: number | undefined
  /** The file types the bulk density: the powder record's is not read. */
  bulkDensityTyped?: boolean
  chamberVolume: number
  /** Solid density of the propellant, kg/m3. */
  density: number
  powderLabel: string | undefined
  missing: ResistanceGap[]
}

/** The summary of a valid step, with the solid-fill and resistance warnings of a simulation. */
function summarizeStep(
  s: ValidStep,
  { bulkDensity, chamberVolume, density, powderLabel, missing }: SummaryInputs,
) {
  const ratio = loadRatio(s.charge, bulkDensity, chamberVolume)
  const warnings: Warning[] = [...s.warnings]
  if (powderLabel && missing.length > 0)
    warnings.push(
      warning(
        advisoryRule.resistanceNotApplied,
        `Simulation: the parameters of ${powderLabel} were fitted with a bore-resistance law this run cannot apply (missing: ${missing.map((m) => resistanceGapText[m]).join(', ')}); the results are biased.`,
      ),
    )
  const fill = solidFill(s.charge, density, chamberVolume)
  if (fill > solidFillLimit)
    warnings.push(
      warning(
        advisoryRule.loadRatioHigh,
        `Simulation: ${
          ratio === undefined || bulkDensity === undefined
            ? `solid fill ${fill.toFixed(2)} is above ${solidFillLimit}`
            : `load ratio ${ratio.toFixed(2)} is above ${fillLoadRatioLimit(density, bulkDensity).toFixed(2)}, solid fill ${solidFillLimit} for this powder`
        }; the model is outside the range it was built for.`,
      ),
    )
  const { result } = s
  return {
    charge: s.charge,
    summary: {
      peakPressure: s.pressureRange.nominalPressure,
      muzzleVelocity: result.muzzleVelocity,
      muzzleEnergy: result.muzzleEnergy,
      barrelTime: result.barrelTime,
      loadRatio: ratio,
      muzzleBurntFraction: result.muzzleBurntFraction,
    },
    pressureRange: s.pressureRange,
    limits: s.limits,
    warnings,
  }
}

/** What a simulation's answer reads besides the payload of its interior run. */
type AnswerInputs = {
  name: string
  load: InteriorLoad
  around: boolean
  curves: boolean
  bullet: Bullet | undefined
  powder: Powder | undefined
  resistance: InteriorLoad['resistance']
  summary: SummaryInputs
}

/** The shown step: the middle of a ladder around the charge when it is valid, else the first valid one; -1 when none is. */
function shownStep(all: SimulateStep[], around: boolean) {
  const middle = around ? (all.length - 1) / 2 : 0
  const middleStep = all[middle]
  return middleStep && 'result' in middleStep ? middle : all.findIndex((s) => 'result' in s)
}

/** The `resolved` part of a simulation: the run's cartridge and the records with the fields they supplied. */
function resolvedRecords(
  cartridge: unknown,
  { bullet, powder, resistance, summary }: AnswerInputs,
) {
  return {
    cartridge,
    bullet: bullet && resolvedRecord(bullet, resistance && bullet.length ? ['length'] : []),
    powder:
      powder &&
      resolvedRecord(powder, [
        ...(summary.bulkDensity && !summary.bulkDensityTyped ? ['bulkDensity'] : []),
        ...(powder.interior?.resistance ? ['interior.resistance'] : []),
      ]),
  }
}

/** From the 200 payload of its interior run: the summary of the shown step (the middle of a ladder around the charge, else the first valid one), its points when asked, the ladder's summaries and the resolved records; 422 when no step is valid. */
function simulateAnswer(
  payload: Record<string, unknown>,
  inputs: AnswerInputs,
): { status: 200 | 422; payload: object } {
  const { name, load, around, curves, summary } = inputs
  const { ladderSteps: steps, resolved } = payload as {
    ladderSteps?: SimulateStep[]
    resolved?: { cartridge?: unknown }
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a single run's 200 payload is the fields of one step
  const all = steps ?? [{ charge: load.charge, ...(payload as object) } as SimulateStep]
  const shown = shownStep(all, around)
  const results = all.map((s) => ('result' in s ? summarizeStep(s, summary) : s))
  if (shown < 0)
    return {
      status: 422,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- with no valid step, the first one failed
      payload: { ...unprocessable, ...(all[0] as { error: object }).error, notice },
    }
  return {
    status: 200,
    payload: assertFinite({
      notice,
      units: { charge: 'kg', summary: summaryUnits, points: responseUnits.m3 },
      loadName: name,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the shown step is a valid one, so its summary
      ...(results[shown] as ReturnType<typeof summarizeStep>),
      // once, with the shown step: the ladder's steps carry none
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the shown step is a valid one, so it has a result
      ...(curves && { points: (all[shown] as { result: M3Result }).result.points }),
      ...(steps && { shown, ladderSteps: results }),
      resolved: resolvedRecords(resolved?.cartridge, inputs),
    }),
  }
}

/** A mass in kg as the file's grams, rounded to a milligram. */
const grams = (kg: number) => Number(fromSi('mass', kg).toFixed(3))

/** An issue of the `/interior` body at its path in the file; the charge step's cap in the file's grams. */
function fileIssue(i: z.core.$ZodIssue, at: PropertyKey[]) {
  const inGrams = i.code === 'too_big' && i.path.join('.') === 'ladder.chargeStep'
  return {
    ...i,
    ...(inGrams && { message: `Too big: expected number to be <=${grams(Number(i.maximum))}` }),
    path: filePath(i.path, at),
  }
}

/** Throws the `InputError` (a 422) of a ladder whose lowest charge (kg) is 0 or below, in the file's grams, as the core states it in kg. */
function needChargesAboveZero(charge: number, ladder: InteriorBody['ladder']) {
  if (!ladder) return
  const below = { up: 0, down: ladder.stepCount - 1, around: (ladder.stepCount - 1) / 2 }
  const lowest = charge - below[ladder.direction ?? 'up'] * ladder.chargeStep
  if (lowest <= 0)
    throw new InputError({ code: 'ladderChargeNotAboveZero', params: { charge: grams(lowest) } })
}

/** The bulk density of the run, kg/m3: the file's own, else the powder record's. */
const bulkDensityOf = (values: Record<string, number>, powder: Powder | undefined) => ({
  bulkDensity: values['bulkDensity'] ?? (powder && powderBulkDensity(powder)),
  bulkDensityTyped: values['bulkDensity'] !== undefined,
})

/** Sets the temperature sensitivity a run of `powder` takes on `load` (`recordSensitivity`); none leaves it. */
function takeSensitivity(load: InteriorLoad, powder: Powder | undefined) {
  const taken = powder && recordSensitivity(powder)
  if (taken) load.propellant.temperatureSensitivity = taken.sensitivity
}

/** The file's charge ladder as the interior body takes it; none for one step or another kind. */
function chargeLadderOf(ladder: NonNullable<Load['analysis']>['ladder']) {
  const step = ladder?.step && toSi(ladderStepKinds[ladder.kind ?? 'charge'], ladder.step)
  return ladder &&
    (ladder.kind ?? 'charge') === 'charge' &&
    ladder.stepCount > 1 &&
    step !== undefined
    ? { chargeStep: step, stepCount: ladder.stepCount, direction: ladder.direction }
    : undefined
}

/** The file's interior body, a `ZodError` at the file's paths: it is checked before any record is read, so a bad file answers 400 whatever its ids. */
function bodyParser({
  load,
  record,
  values,
  chargeLadder,
  path,
}: {
  load: InteriorLoad
  record: Load
  values: Record<string, number>
  chargeLadder: ReturnType<typeof chargeLadderOf>
  path: Path
}) {
  return (resistance?: InteriorLoad['resistance']) => {
    try {
      return interiorBody.parse({
        model: 'm3',
        load: resistance ? { ...load, resistance } : load,
        ...(record.cartridge && { cartridge: catalogueIdOf(record.cartridge) }),
        ...(values['pmax'] !== undefined && { pressureLimit: values['pmax'] }),
        ...(chargeLadder && { ladder: chargeLadder }),
      })
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new z.ZodError(error.issues.map((i) => fileIssue(i, path)))
      throw error
    }
  }
}

/** A seating ladder needs the drawing package's seating geometry, which this route lacks, and a temperature ladder is not run here. */
function ladderKindRefusal(ladder: NonNullable<Load['analysis']>['ladder']) {
  return ladder?.kind === 'seating' || ladder?.kind === 'temperature'
    ? {
        status: 422 as const,
        payload: {
          ...unprocessable,
          message: `ladder.kind: a ${ladder.kind} ladder runs in the workbench, not in this route`,
          field: 'ladder.kind',
          notice,
        },
      }
    : undefined
}

/** An empty bore area takes the cartridge record's, as the workbench fills it, with the record's land diameter as the bore. */
function fillBoreArea(
  load: InteriorLoad,
  cartridge: CartridgeWithSpecs | undefined,
  values: Record<string, number>,
) {
  if (cartridge && values['boreArea'] === undefined)
    load.chamber.boreArea = toSi(
      'area',
      boreArea({
        area: recordBoreArea(
          cartridgeBoreAreaMm2(cartridge),
          cartridgeLandDiameterMm(cartridge),
          fromSi('length', load.chamber.boreDiameter),
        ),
        boreDiameter: fromSi('length', load.chamber.boreDiameter),
        grooveDiameter: cartridgeGrooveDiameterMm(cartridge),
      }),
    )
}

/** The bore resistance of the powder record's fit, as the workbench adds it to a run. */
function powderResistance(
  load: InteriorLoad,
  {
    cartridge,
    bullet,
    powder,
    values,
  }: {
    cartridge: CartridgeWithSpecs | undefined
    bullet: Bullet | undefined
    powder: Powder | undefined
    values: Record<string, number>
  },
) {
  return recordResistance(powder ?? {}, {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: cartridge && {
      g1: cartridgeBulletDiameterMm(cartridge),
      z: cartridgeGrooveDiameterMm(cartridge),
    },
    bulletLengthMm: bulletLengthMm(values, bullet),
  })
}

/** One `POST /interior/load-file` request (`query`, the load file `json`): the status and body of the answer. */
export async function simulate(
  context: { catalogue: Catalogue; compute: ComputeRunner },
  query: unknown,
  json: unknown,
): Promise<{ status: 200 | 422; payload: object }> {
  const parsed = simulateQuery.safeParse(query)
  if (!parsed.success) throw unknownKeyIssues(parsed.error)
  const { curves } = parsed.data
  const { path, record, name } = readLoadFile(json)
  const values = loadValues(record, knownRecords(context.catalogue, record))
  const lacking = missingValuesAnswer(values, path)
  if (lacking) return lacking
  const load = fileLoad(values, path)
  const ladder = record.analysis?.ladder
  const chargeLadder = chargeLadderOf(ladder)
  const parseBody = bodyParser({ load, record, values, chargeLadder, path })
  needChargesAboveZero(load.charge, parseBody().ladder)
  const refusal = ladderKindRefusal(ladder)
  if (refusal) return refusal
  const { cartridge, bullet, powder, powderLabel } = loadFileRecords(context.catalogue, record)
  fillBoreArea(load, cartridge, values)
  // the temperature sensitivity of the powder record, its own or the default of its grain form, as the workbench adds it to a run
  takeSensitivity(load, powder)
  const { resistance, missing } = powderResistance(load, { cartridge, bullet, powder, values })
  // the powder record's resistance with the file's overrides: one engraving value alone completes the record's ramp, so the pair is only known here
  const applied = fileResistance(values, path, resistance)
  const { status, payload } = await runInterior(
    { compute: context.compute, findCartridge: (id) => findCartridge(context.catalogue, id) },
    parseBody(applied),
    cartridge,
  )
  if (status !== 200) return { status, payload }
  return simulateAnswer(payload, {
    name,
    load,
    around: ladder?.direction === 'around' && Boolean(chargeLadder),
    curves: curves === 'true',
    bullet,
    powder,
    resistance,
    summary: {
      ...bulkDensityOf(values, powder),
      chamberVolume: load.chamber.volume,
      density: load.propellant.density,
      powderLabel,
      missing,
    },
  })
}
