/**
 * `POST /interior/load-file` input: the workbench load file as Save writes it, read
 * to the `POST /interior` body. The field mapping is `interiorLoad` of core, the one the
 * workbench uses; this module adds the file check and the record lookups.
 */
import {
  checkResistanceValues,
  type InteriorLoad,
  interiorLoad,
  overrideResistance,
  ValueError,
  workbenchValueKeys,
} from '@open-reloading/core'
import { parseRef, userDataFile, versionProblem, type WorkbenchState } from '@open-reloading/schema'
import { z } from 'zod'

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
 * The one `workbenchState` record of a load file. Throws a `ZodError` with the path of each problem:
 * an unknown field, an invalid value, no or several loads, a `siValues` key the workbench does not write.
 */
export function readLoadFile(json: unknown): { path: Path; record: WorkbenchState; name: string } {
  const problem = versionProblem(json)
  if (problem) throw new z.ZodError([issue(['version'], problem)])
  const file = userDataFile.safeParse(json)
  if (!file.success) throw file.error
  const unknown = unknownKeys(json, file.data, []).map((p) => issue(p, 'Unknown field'))
  const loads = file.data.records.flatMap((r, i) => (r.kind === 'workbenchState' ? [[i, r]] : []))
  if (loads.length !== 1)
    unknown.push(
      issue(
        ['records'],
        `The file must hold exactly one workbenchState record, it has ${loads.length}`,
      ),
    )
  else {
    const [i, r] = loads[0] as [number, { data: WorkbenchState; name: string }]
    for (const k of Object.keys(r.data.siValues))
      if (!(workbenchValueKeys as readonly string[]).includes(k))
        unknown.push(issue(['records', i, 'data', 'siValues', k], 'Unknown field'))
    // user data stays in the browser: the server resolves catalogue records only
    for (const k of ['cartridge', 'bullet'] as const) {
      const target = r.data[k]
      if (target && parseRef(target)?.scope === 'user')
        unknown.push(
          issue(
            ['records', i, 'data', k],
            'A user record is not on the server, name a catalogue record',
          ),
        )
    }
  }
  if (unknown.length > 0) throw new z.ZodError(unknown)
  const [i, r] = loads[0] as [number, { data: WorkbenchState; name: string }]
  return { path: ['records', i, 'data'], record: r.data, name: r.name }
}

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

/** `siValues` key of an `/interior` load path, for the errors of the interior schema. */
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

/**
 * The path in the load file of an issue at `path` of the `/interior` body: `load.<field>` to the
 * `siValues` key, `ladder.<key>` to the file's ladder, else the body path.
 */
export function filePath(path: PropertyKey[], at: Path): Path {
  const [head, ...rest] = path.map(String)
  const key = head === 'load' ? siKey[rest.join('.')] : undefined
  if (key) return [...at, 'siValues', key]
  if (head === 'ladder') return [...at, 'ladder', ...rest]
  return path
}

/** Runs `read`; a `ValueError` is a `ZodError` at the `siValues` path of its field. */
function atField<T>(at: Path, read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof ValueError)
      throw new z.ZodError([issue([...at, 'siValues', error.field], error.message)])
    throw error
  }
}

/** The load of the file as `/interior` takes it; a missing value is a `ZodError` at its `siValues` path. */
export const fileLoad = (data: WorkbenchState, at: Path): InteriorLoad =>
  atField(at, () => {
    checkResistanceValues(data.siValues)
    return interiorLoad(data.siValues)
  })

/** The bore resistance of the powder record with the file's overrides (`overrideResistance`). */
export const fileResistance = (
  data: WorkbenchState,
  at: Path,
  record: InteriorLoad['resistance'],
): InteriorLoad['resistance'] => atField(at, () => overrideResistance(record, data.siValues))
