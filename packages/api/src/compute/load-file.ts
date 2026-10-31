/**
 * `POST /interior/load-file` input: a load file (one record of kind `load`), read
 * to the `POST /interior` body. A value the workbench leaves out because its Settings, followed
 * defaults or seating give it (temperature, volume, bore diameter, twist, travel) is not
 * filled here: the route answers 422 with every such value. The field mapping is `interiorLoad` of core, the one the
 * workbench uses; this module adds the file check, the values the referenced records give and
 * the record lookups.
 */
import {
  checkResistanceValues,
  type InteriorLoad,
  interiorLoad,
  missingLoadKeys,
  overrideResistance,
  powderModelValues,
  ValueError,
} from '@open-reloading/core'
import {
  type AnalysisKey,
  analysisKinds,
  type Bullet,
  fromSi,
  type Load,
  legacyLoadProblem,
  type Powder,
  parseRef,
  type QuantityKind,
  toSi,
  userDataFile,
  versionProblem,
} from '@open-reloading/schema'
import { z } from 'zod'
import { notice, unprocessable } from './answer.ts'

type Path = PropertyKey[]
const issue = (path: Path, message: string): z.core.$ZodIssue => ({
  code: 'custom',
  path,
  message,
})

/** Paths of the keys of `input` that `parsed` (zod strips unknown keys) lacks. */
function unknownKeys(input: unknown, parsed: unknown, path: Path): Path[] {
  if (Array.isArray(input) && Array.isArray(parsed))
    return input.flatMap((x, i) => unknownKeys(x, parsed[i], [...path, i]))
  if (!input || !parsed || typeof input !== 'object' || typeof parsed !== 'object') return []
  const kept = parsed as Record<string, unknown>
  return Object.entries(input).flatMap(([k, v]) =>
    Object.hasOwn(kept, k) ? unknownKeys(v, kept[k], [...path, k]) : [[...path, k]],
  )
}

/**
 * The one `load` record of a load file. Throws a `ZodError` with the path of each problem: an
 * unknown field, an invalid value, a record of the old format, no or several loads, a `user:`
 * reference the server cannot resolve.
 */
export function readLoadFile(json: unknown): { path: Path; record: Load; name: string } {
  const problem = versionProblem(json)
  if (problem) throw new z.ZodError([issue(['version'], problem)])
  const old = (json as { records?: unknown } | null)?.records
  if (Array.isArray(old)) {
    const at = old.findIndex((r) => (r as { kind?: unknown } | null)?.kind === 'workbenchState')
    if (at >= 0) throw new z.ZodError([issue(['records', at, 'kind'], legacyLoadProblem)])
  }
  const file = userDataFile.safeParse(json)
  if (!file.success) throw unknownKeyIssues(file.error)
  const unknown = unknownKeys(json, file.data, []).map((p) => issue(p, 'Unknown field'))
  const loads = file.data.records.flatMap((r, i) => (r.kind === 'load' ? [[i, r]] : []))
  if (loads.length !== 1)
    unknown.push(
      issue(['records'], `The file must hold exactly one load record, it has ${loads.length}`),
    )
  else {
    const [i, r] = loads[0] as [number, { data: Load; name: string }]
    // user data stays in the browser: the server resolves catalogue records only
    for (const k of ['cartridge', 'bullet', 'powder'] as const) {
      const target = r.data[k]
      if (typeof target === 'string' && parseRef(target)?.scope === 'user')
        unknown.push(
          issue(
            ['records', i, 'data', k],
            'A user record is not on the server, name a catalogue record',
          ),
        )
    }
  }
  if (unknown.length > 0) throw new z.ZodError(unknown)
  const [i, r] = loads[0] as [number, { data: Load; name: string }]
  return { path: ['records', i, 'data'], record: r.data, name: r.name }
}

/** The records of a load the catalogue gives values from. */
export interface LoadRecords {
  /** The powder record the load names. */
  powder?: Powder | undefined
  /** The bullet record the load names. */
  bullet?: Bullet | undefined
}

/**
 * The SI solver values of a load, by workbench key: what its powder record's model parameters and
 * its bullet record's mass give, then the values it overrides (stored units to SI), then its
 * charge. A value no record gives is absent.
 */
export function loadValues(data: Load, { powder, bullet }: LoadRecords): Record<string, number> {
  const typed = Object.entries(data.analysis?.overrides ?? {}).flatMap(([k, v]) =>
    v === undefined ? [] : [[k, toSi(analysisKinds[k as AnalysisKey], v)]],
  )
  return {
    ...(powder && powderModelValues(powder)),
    ...(bullet && { bulletMass: toSi('mass', bullet.mass.value) }),
    ...Object.fromEntries(typed),
    ...(data.charge && { charge: toSi('mass', data.charge.value) }),
  }
}

/** The bullet length the bore resistance law reads, mm: the typed `bulletLength`, else the record's. */
export const bulletLengthMm = (values: Record<string, number>, bullet: Bullet | undefined) =>
  values.bulletLength === undefined ? bullet?.length?.value : fromSi('length', values.bulletLength)

/** The catalogue record id of a `cartridge` or `bullet` of a load file: a plain id or a `catalogue:` reference. */
export const catalogueIdOf = (target: string) => parseRef(target)?.id ?? target

/** The issues of a strict-object error with one issue per unknown key, at the key's path. */
export function unknownKeyIssues(error: z.ZodError) {
  return new z.ZodError(
    error.issues.flatMap((i) =>
      i.code === 'unrecognized_keys'
        ? i.keys.map((k) => issue([...i.path, k], 'Unknown field'))
        : [i],
    ),
  )
}

/** Workbench key of an `/interior` load path, for the errors of the interior schema. */
const siKey: Record<string, string> = {
  'chamber.volume': 'volume',
  'chamber.boreArea': 'boreArea',
  'chamber.boreDiameter': 'boreDiameter',
  'barrel.length': 'travel',
  'barrel.twist': 'twist',
  'bullet.mass': 'bulletMass',
  charge: 'charge',
  'propellant.specificEnergy': 'propellantEnergy',
  'propellant.gamma': 'gamma',
  'propellant.density': 'density',
  'propellant.covolume': 'covolume',
  'propellant.burn.vivacity': 'vivacity',
  'propellant.burn.exponent': 'exponent',
  'propellant.burn.referencePressure': 'referencePressure',
  'propellant.burn.form.a': 'formA',
  'propellant.burn.form.m': 'formM',
  'propellant.burn.form.q': 'formQ',
  'propellant.burn.form.z1': 'formZ1',
  propellantTemperature: 'propellantTemperature',
  ignitionPressure: 'ignitionPressure',
  startPressure: 'startPressure',
  'gradient.energy': 'sebert',
  'gradient.breech': 'sebert',
  'resistance.friction': 'boreFriction',
  'resistance.engraving.0.pressure': 'engravingPressure',
  'resistance.engraving.1.travel': 'engravingLength',
  'leakage.area.0.area': 'leakArea',
  'leakage.area.1.area': 'leakArea',
  'leakage.area.1.travel': 'travel',
}

/** The path in the load file of a workbench value: the load's `charge`, else its override. */
const valuePath = (at: Path, key: string): Path =>
  key === 'charge' ? [...at, 'charge'] : [...at, 'analysis', 'overrides', key]

/** One solver value a load file lacks. */
interface MissingValue {
  /** The workbench key of the value. */
  key: string
  /** Where the file holds it: the load's `charge`, else its key under `analysis.overrides`. */
  path: PropertyKey[]
  /** The quantity of its stored unit. */
  quantity: QuantityKind
}

/** The 422 answer of a load file that lacks solver values. */
export interface MissingValuesAnswer {
  status: 422
  payload: {
    statusCode: 422
    error: string
    message: string
    reason: 'missingValues'
    missing: MissingValue[]
    notice: string
  }
}

/**
 * The 422 answer for a load file that lacks solver values, or undefined when it has them all: one
 * entry per missing value with its path in the file and its stored quantity.
 */
export function missingValuesAnswer(
  values: Record<string, number>,
  at: Path,
): MissingValuesAnswer | undefined {
  const keys = missingLoadKeys(values)
  if (keys.length === 0) return
  return {
    status: 422,
    payload: {
      ...unprocessable,
      message: `The load file lacks ${keys.length} ${keys.length === 1 ? 'value' : 'values'}: ${keys.join(', ')}. Type them under analysis.overrides, or name catalogue records that give them.`,
      reason: 'missingValues',
      missing: keys.map((key) => ({
        key,
        path: valuePath(at, key),
        quantity: key === 'charge' ? 'mass' : analysisKinds[key as AnalysisKey],
      })),
      notice,
    },
  }
}

/**
 * The path in the load file of an issue at `path` of the `/interior` body: `load.<field>` to the
 * file's value, `ladder.<key>` to the file's ladder, else the body path.
 */
export function filePath(path: PropertyKey[], at: Path): Path {
  const [head, ...rest] = path.map(String)
  const key = head === 'load' ? siKey[rest.join('.')] : undefined
  if (key) return valuePath(at, key)
  if (head === 'ladder')
    return [...at, 'analysis', 'ladder', ...rest.map((k) => (k === 'chargeStep' ? 'step' : k))]
  return path
}

/** Runs `read`; a `ValueError` is a `ZodError` at the path of its field in the file. */
function atField<T>(at: Path, read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof ValueError)
      throw new z.ZodError([issue(valuePath(at, error.field), error.message)])
    throw error
  }
}

/** The load of the file as `/interior` takes it; a missing value is a `ZodError` at its path in the file. */
export const fileLoad = (values: Record<string, number>, at: Path): InteriorLoad =>
  atField(at, () => {
    checkResistanceValues(values)
    return interiorLoad(values)
  })

/** The bore resistance of the powder record with the file's overrides (`overrideResistance`). */
export const fileResistance = (
  values: Record<string, number>,
  at: Path,
  record: InteriorLoad['resistance'],
): InteriorLoad['resistance'] => atField(at, () => overrideResistance(record, values))
