/**
 * CIP Pmax of a cartridge against a simulated pressure range. Only values measured by transducer or piezo, or without a stated method, are
 * compared; crusher values are listed, never compared. No message says or implies that a load is safe.
 */
import {
  type AdvisoryId,
  type AdvisoryLoad,
  type AdvisoryRule,
  advisoryRule,
  chargeTooSmall,
  chargeTooSmallRatio,
  interiorAdvisories,
  type MaximumPlacement,
  type PressureRange,
  placeMaximum,
} from '@open-reloading/core'
import { type Cartridge, fromSi, type SpecValue, sheetId, toSi } from '@open-reloading/schema'

/** The fields of a `getCartridge` record that the limit check reads. */
export type CartridgeWithSpecs = Pick<
  Cartridge,
  'id' | 'name' | 'published' | 'revised' | 'pressureMethod' | 'provenance'
> & { values: Pick<SpecValue, 'symbol' | 'value' | 'variant'>[] }

/** One Pmax of a cartridge's C.I.P. sheet and its comparison with the simulated range. */
export type Limit = {
  /** Id of the cartridge. */
  cartridge: string
  /** Date of the sheet revision, `revised` or else `published`. */
  revised: string
  symbol: string
  method: string | null
  variant?: string
  /** Pa. */
  pressure?: number
  compared: boolean
  /** Why it is not compared: `noValue`, or the measuring method (`crusher`). */
  reason?: string
  /** The high end of the range is above the limit. */
  exceeded?: boolean
  /** The nominal value is above the limit. */
  nominalExceeded?: boolean
}

/**
 * A message of an interior response; `code` names the rule of the advisory registry of core, with its
 * `severity`, `inputs` and `fix`. `spec` is the id of the C.I.P. sheet it refers to, and `symbol`,
 * `variant` and `method` the limit of a `limitExceeded` message.
 */
export type Warning = {
  code: AdvisoryId
  severity: AdvisoryRule['severity']
  inputs: string[]
  message: string
  fix: string
  spec?: string
  symbol?: string
  variant?: string
  method?: string | null
}

/** A warning of `rule` with the registry's severity, inputs and fix around `message`. */
export function warning(
  rule: AdvisoryRule,
  message: string,
  extra: Pick<Warning, 'spec' | 'symbol' | 'variant' | 'method'> = {},
): Warning {
  const { id, severity, inputs, fix } = rule
  return { code: id, severity, inputs: [...inputs], message, fix, ...extra }
}

const compared = new Set(['transducer', 'piezo', null])
/** A simulated pressure in whole bar, with more decimals while rounding would put it on or across the limit. */
function bar(pa: number, limit: number) {
  const p = fromSi('pressure', pa)
  let d = 0
  while (d < 5 && Math.sign(toSi('pressure', +p.toFixed(d)) - limit) !== Math.sign(pa - limit)) d++
  return `${p.toFixed(d)} bar`
}

function limit(
  c: CartridgeWithSpecs,
  v: CartridgeWithSpecs['values'][number],
  range: PressureRange,
): Limit {
  const method = c.pressureMethod ?? null
  const base = {
    cartridge: c.id,
    revised: c.revised ?? c.published,
    symbol: v.symbol,
    method,
    ...(v.variant !== undefined && { variant: v.variant }),
  }
  if (v.value === undefined) return { ...base, compared: false, reason: 'noValue' }
  const pressure = toSi('pressure', v.value)
  if (!compared.has(method)) return { ...base, pressure, compared: false, reason: String(method) }
  return {
    ...base,
    pressure,
    compared: true,
    exceeded: range.highPressure > pressure,
    nominalExceeded: range.nominalPressure > pressure,
  }
}

function exceededMessage(l: Limit, range: PressureRange) {
  const name = `CIP ${l.symbol}${l.variant ? ` (${l.variant})` : ''}`
  const where = `${sheetId({ id: l.cartridge, published: l.revised })}; ${l.method ?? 'measuring method not stated in the record'}`
  const limit = l.pressure as number
  // the limit with the decimals stored in the record
  const limitText = `${name} ${+fromSi('pressure', limit).toPrecision(12)} bar (${where})`
  const { nominalPressure: p0, lowPressure: low, highPressure: high } = range
  return l.nominalExceeded
    ? `Simulated peak pressure ${bar(p0, limit)} (range ${Math.round(fromSi('pressure', low))} to ${bar(high, limit)}) is above ${limitText}.`
    : `The upper end of the simulated peak pressure range, ${bar(high, limit)}, is above ${limitText}; the nominal value is ${bar(p0, limit)}.`
}

/** A user-entered maximum placed against a pressure range: the class, the dominant input and a statement about the range. */
export type MaximumCheck = MaximumPlacement & {
  /** The entered maximum, Pa. */
  maximum: number
  message: string
}

/** Places a user-entered maximum (Pa) against `range`; the message states a fact about the simulated range only. */
export function maximumCheck(range: PressureRange, maximum: number): MaximumCheck {
  const placement = placeMaximum(range, maximum)
  const { lowPressure: low, highPressure: high } = range
  const m = `The entered maximum, ${bar(maximum, maximum)}`
  const message = {
    inputPlausible: `${m}, is inside the simulated peak-pressure range of this load, ${bar(low, maximum)} to ${bar(high, maximum)}.`,
    modelDiscrepancy: `${m}, is below the lower end of the simulated peak-pressure range of this load, ${bar(low, maximum)}. The simulation and the entered maximum do not agree for these inputs.`,
    aboveRange: `${m}, is above the upper end of the simulated peak-pressure range, ${bar(high, maximum)}.`,
  }[placement.class]
  return { ...placement, maximum, message }
}

/** The charge-too-small rule on an M3 peak mean pressure, start and ignition pressure, Pa. */
function chargeWarning(charge: {
  meanPressure: number
  startPressure: number
  ignitionPressure: number
}): Warning | undefined {
  const { meanPressure: p, startPressure: ps, ignitionPressure: pi } = charge
  if (!chargeTooSmall(p, ps, pi)) return undefined
  const hold = Math.max(ps, pi)
  const limit = chargeTooSmallRatio * hold
  return warning(
    advisoryRule.chargeTooSmall,
    `Charge too small for the model: the simulated peak mean pressure, ${bar(p, limit)}, is below ${chargeTooSmallRatio} times the ${ps >= pi ? 'start' : 'ignition'} pressure (${bar(hold, limit)}); results are outside the range the model was built for.`,
  )
}

/**
 * The Pmax limits of the C.I.P. sheet of `cartridge` against `range`, their warnings
 * (`noCartridge` without a cartridge, else `limitExceeded` per exceeded limit and
 * `noComparableLimit`) and the cartridge part of `resolved`.
 */
function cartridgeLimits(range: PressureRange, cartridge: CartridgeWithSpecs | undefined) {
  const warnings: Warning[] = []
  if (cartridge === undefined) {
    warnings.push(
      warning(advisoryRule.noCartridge, 'No cartridge id was given, so no CIP Pmax was checked.'),
    )
    return { limits: undefined, warnings, resolved: undefined }
  }
  const limits = cartridge.values
    .filter((v) => v.symbol === 'Pmax')
    .map((v) => limit(cartridge, v, range))
  for (const l of limits)
    if (l.exceeded)
      warnings.push(
        warning(advisoryRule.limitExceeded, exceededMessage(l, range), {
          spec: sheetId(cartridge),
          symbol: l.symbol,
          ...(l.variant !== undefined && { variant: l.variant }),
          method: l.method,
        }),
      )
  if (!limits.some((l) => l.compared))
    warnings.push(
      warning(
        advisoryRule.noComparableLimit,
        `${cartridge.name} has no CIP Pmax measured by transducer or piezo. Crusher values are not compared with a simulated pressure.`,
      ),
    )
  const resolved = { id: cartridge.id, name: cartridge.name, provenance: cartridge.provenance }
  return { limits, warnings, resolved }
}

/** `rangeIncomplete` when some cases of the range could not be computed. */
function rangeWarnings(range: PressureRange): Warning[] {
  const failed = range.cases.filter((c) => c.maxPressure === null)
  if (failed.length === 0) return []
  return [
    warning(
      advisoryRule.rangeIncomplete,
      `${failed.length} of ${range.cases.length} range cases could not be computed (${[...new Set(failed.map((c) => c.reason))].join(', ')}); the range covers only the computed cases, and the true range can be wider.`,
    ),
  ]
}

/** The cartridge echo of a limit check: the record whose limits were read. */
interface CheckedCartridge {
  id: string
  name: string
  provenance: unknown
}

/** Result of {@link limitCheck}: `limits` and `cartridge` undefined without a cartridge. */
interface LimitCheck {
  limits: Limit[] | undefined
  warnings: Warning[]
  cartridge: CheckedCartridge | undefined
}

/** An M3 run for the charge-too-small check and the input rules: its peak mean pressure and its load, Pa. */
interface ChargeRun {
  result: { maxMeanPressure: number }
  load: AdvisoryLoad & { ignitionPressure: number }
}

/**
 * Limits, warnings and the cartridge echo for a pressure range; `cartridge` undefined when no id
 * was given. `run` (M3 only) adds the charge-too-small check and the input rules of the registry.
 */
export function limitCheck(
  range: PressureRange,
  cartridge: CartridgeWithSpecs | undefined,
  run?: ChargeRun,
): LimitCheck {
  const { limits, warnings, resolved } = cartridgeLimits(range, cartridge)
  warnings.push(...rangeWarnings(range))
  const small =
    run &&
    chargeWarning({
      meanPressure: run.result.maxMeanPressure,
      startPressure: run.load.startPressure,
      ignitionPressure: run.load.ignitionPressure,
    })
  if (small) warnings.push(small)
  if (run) warnings.push(...interiorAdvisories(run.load).map((a) => warning(a, a.message)))
  return { limits, warnings, cartridge: resolved }
}
