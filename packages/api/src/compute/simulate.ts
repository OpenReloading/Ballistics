/** `POST /interior/load-file`: an M3 run of the workbench load file, with the summary the workbench shows. */
import {
  boreArea,
  cartridgeBoreAreaMm2,
  cartridgeBulletDiameterMm,
  cartridgeGrooveDiameterMm,
  fillLoadRatioLimit,
  type InteriorLoad,
  loadRatio,
  type PressureRange,
  recordResistance,
  solidFill,
  solidFillLimit,
} from '@openreloading/core'
import {
  type Bullet,
  fromSi,
  type Load,
  ladderStepKinds,
  type Powder,
  toSi,
} from '@openreloading/schema'
import { z } from 'zod'
import type { Catalogue } from '../catalogue/types.ts'
import { assertFinite, notice, resolvedRecord, unprocessable } from './answer.ts'
import { powderBulkDensity } from './charge-run.ts'
import { runInterior } from './interior-run.ts'
import { interiorBody } from './interior-schema.ts'
import type { CartridgeWithSpecs, Warning } from './limits.ts'
import {
  catalogueIdOf,
  fileLoad,
  filePath,
  fileResistance,
  loadValues,
  readLoadFile,
  unknownKeyIssues,
} from './load-file.ts'
import { findBullet, findCartridge, findPowder } from './resolve.ts'
import type { ComputeRunner, Results } from './tasks.ts'
import { responseUnits } from './units.ts'

/** Query of `POST /interior/load-file`: the body is the load file, so the query is the only option. */
export const simulateQuery = z.strictObject({
  curves: z
    .enum(['true', 'false'])
    .optional()
    .describe('`true` adds the time curves (`points`) of the shown run. Default `false`.'),
})

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

/**
 * The cartridge, bullet and powder records the file names, in that order, and the powder's label
 * "<manufacturer name> <product name>"; 404 for an unknown id.
 */
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
  chamberVolume: number
  /** Solid density of the propellant, kg/m3. */
  density: number
  powderLabel: string | undefined
  missing: string[]
}

/** The summary of a valid step, with the solid-fill and resistance warnings of a simulation. */
function summarizeStep(
  s: ValidStep,
  { bulkDensity, chamberVolume, density, powderLabel, missing }: SummaryInputs,
) {
  const ratio = loadRatio(s.charge, bulkDensity, chamberVolume)
  const warnings: Warning[] = [...s.warnings]
  if (powderLabel && missing.length > 0)
    warnings.push({
      code: 'resistanceNotApplied',
      message: `Simulation: the parameters of ${powderLabel} were fitted with a bore-resistance law this run cannot apply (missing: ${missing.join(', ')}); the results are biased.`,
    })
  const fill = solidFill(s.charge, density, chamberVolume)
  if (fill > solidFillLimit)
    warnings.push({
      code: 'loadRatioHigh',
      message: `Simulation: ${
        ratio === undefined || bulkDensity === undefined
          ? `solid fill ${fill.toFixed(2)} is above ${solidFillLimit}`
          : `load ratio ${ratio.toFixed(2)} is above ${fillLoadRatioLimit(density, bulkDensity).toFixed(2)}, solid fill ${solidFillLimit} for this powder`
      }; the model is outside the range it was built for.`,
    })
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

/**
 * The status and body of a simulation from the 200 payload of its interior run: the summary of the
 * shown step (the middle of a ladder around the charge, else the first valid one), its points when
 * asked, the ladder's summaries and the resolved records; 422 when no step is valid.
 */
function simulateAnswer(
  payload: Record<string, unknown>,
  {
    name,
    load,
    around,
    curves,
    bullet,
    powder,
    resistance,
    summary,
  }: {
    name: string
    load: InteriorLoad
    around: boolean
    curves: boolean
    bullet: Bullet | undefined
    powder: Powder | undefined
    resistance: InteriorLoad['resistance']
    summary: SummaryInputs
  },
): { status: 200 | 422; payload: object } {
  const { ladderSteps: steps, resolved } = payload as {
    ladderSteps?: SimulateStep[]
    resolved?: { cartridge?: unknown }
  }
  const all = steps ?? [{ charge: load.charge, ...(payload as object) } as SimulateStep]
  const middle = around ? (all.length - 1) / 2 : 0
  const shown = 'result' in all[middle] ? middle : all.findIndex((s) => 'result' in s)
  const results = all.map((s) => ('result' in s ? summarizeStep(s, summary) : s))
  if (shown < 0)
    return {
      status: 422,
      payload: { ...unprocessable, ...(all[0] as { error: object }).error, notice },
    }
  return {
    status: 200,
    payload: assertFinite({
      notice,
      units: { charge: 'kg', summary: summaryUnits, points: responseUnits.m3 },
      loadName: name,
      ...(results[shown] as ReturnType<typeof summarizeStep>),
      // once, with the shown step: the ladder's steps carry none
      ...(curves && { points: (all[shown] as { result: M3Result }).result.points }),
      ...(steps && { shown, ladderSteps: results }),
      resolved: {
        cartridge: resolved?.cartridge,
        bullet: bullet && resolvedRecord(bullet, resistance && bullet.length ? ['length'] : []),
        powder:
          powder &&
          resolvedRecord(powder, [
            ...(summary.bulkDensity ? ['bulkDensity'] : []),
            ...(powder.interior?.resistance ? ['interior.resistance'] : []),
          ]),
      },
    }),
  }
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
  const load = fileLoad(values, path)
  const ladder = record.analysis?.ladder
  const step = ladder?.step && toSi(ladderStepKinds[ladder.kind ?? 'charge'], ladder.step)
  const withLadder =
    ladder && ladder.kind !== 'seating' && ladder.stepCount > 1 && step !== undefined
  // the file is validated before any record is read: a bad file answers 400 whatever its ids
  const parseBody = (resistance?: InteriorLoad['resistance']) => {
    try {
      return interiorBody.parse({
        model: 'm3',
        load: resistance ? { ...load, resistance } : load,
        ...(record.cartridge && { cartridge: catalogueIdOf(record.cartridge) }),
        ...(withLadder && {
          ladder: {
            chargeStep: step,
            stepCount: ladder.stepCount,
            direction: ladder.direction,
          },
        }),
      })
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new z.ZodError(error.issues.map((i) => ({ ...i, path: filePath(i.path, path) })))
      throw error
    }
  }
  parseBody()
  // after the file's checks (a bad file answers 400): a seating ladder needs the seating
  // geometry of the drawing package, which this route lacks
  if (ladder?.kind === 'seating')
    return {
      status: 422,
      payload: {
        ...unprocessable,
        message: 'ladder.kind: a seating ladder runs in the workbench, not in this route',
        field: 'ladder.kind',
        notice,
      },
    }
  const { cartridge, bullet, powder, powderLabel } = loadFileRecords(context.catalogue, record)
  // an empty bore area is the cartridge record's, as the workbench fills it
  if (cartridge && values.boreArea === undefined)
    load.chamber.boreArea = toSi(
      'area',
      boreArea({
        area: cartridgeBoreAreaMm2(cartridge),
        boreDiameter: fromSi('length', load.chamber.boreDiameter),
        grooveDiameter: cartridgeGrooveDiameterMm(cartridge),
      }),
    )
  // the bore resistance of the powder record's fit, as the workbench adds it to a run
  const { resistance, missing } = recordResistance(powder ?? {}, {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: cartridge && {
      g1: cartridgeBulletDiameterMm(cartridge),
      z: cartridgeGrooveDiameterMm(cartridge),
    },
    bulletLengthMm: bullet?.length?.value,
  })
  // the powder record's resistance with the file's overrides: one engraving value alone completes
  // the record's ramp, so the pair is only known here
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
    around: ladder?.direction === 'around' && Boolean(withLadder),
    curves: curves === 'true',
    bullet,
    powder,
    resistance,
    summary: {
      bulkDensity: powder && powderBulkDensity(powder),
      chamberVolume: load.chamber.volume,
      density: load.propellant.density,
      powderLabel,
      missing,
    },
  })
}
