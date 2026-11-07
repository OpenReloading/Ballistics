import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { interior } from '@open-reloading/ballistics'
import { InputError } from '@open-reloading/statistics'
import { UsageError } from './errors.ts'
import type { InteriorModel } from './evaluate.ts'

/** A model version: the function that runs a load and the built source files it stands on. */
export interface Model {
  /** The name or module path it was selected by. */
  name: string
  interior: InteriorModel
  /** Absolute files of the model, labelled for the version hash. */
  files: { label: string; path: string }[]
}

/** The name of the installed core model. */
export const builtInName = 'm3'

const importPattern = /\b(?:from|import)[\s(]*['"](\.{1,2}\/[^'"]+)['"]/g

/** `file` and the files it imports by a relative specifier, directly or not, with `label` made from `root`. */
function closure(file: string, root: string, prefix: string) {
  const seen = new Map<string, string>()
  const queue = [file]
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    if (seen.has(next)) continue
    seen.set(next, `${prefix}/${relative(root, next).split('\\').join('/')}`)
    for (const [, specifier = ''] of readFileSync(next, 'utf8').matchAll(importPattern)) {
      const target = resolve(dirname(next), specifier)
      if (existsSync(target)) queue.push(target)
    }
  }
  return [...seen].map(([path, label]) => ({ label, path }))
}

/** The built files the record to load step, the water density, the unit conversion, the input checks and the seating read, which every model version shares. */
function sharedFiles() {
  const drawing = dirname(
    dirname(fileURLToPath(import.meta.resolve('@open-reloading/drawing/seating'))),
  )
  const schema = dirname(fileURLToPath(import.meta.resolve('@open-reloading/schema')))
  const units = dirname(fileURLToPath(import.meta.resolve('@open-reloading/units')))
  const statistics = dirname(fileURLToPath(import.meta.resolve('@open-reloading/statistics')))
  const ballistics = dirname(fileURLToPath(import.meta.resolve('@open-reloading/ballistics')))
  return {
    statistics,
    ballistics,
    files: [
      // the input checks (`need`, `InputError`) every model module raises its refusals with
      ...closure(join(statistics, 'errors.js'), statistics, 'statistics'),
      ...closure(join(ballistics, 'interior/record-load.js'), ballistics, 'ballistics'),
      // the unit table, whose water density turns every capacity into a chamber volume
      ...closure(join(units, 'units.js'), units, 'units'),
      ...closure(join(schema, 'units.js'), schema, 'schema'),
      ...closure(join(schema, 'case-capacity.js'), schema, 'schema'),
      ...closure(join(drawing, 'seating/index.js'), drawing, 'drawing'),
      ...closure(join(drawing, 'bullet/index.js'), drawing, 'drawing'),
    ],
  }
}

/**
 * The model selected by `spec`: `m3`, the installed core model, or the path of a module that
 * exports `interior(load, options?)` with the signature of the core function. Throws a `UsageError`
 * for a module that cannot be loaded or has no such export.
 */
export async function loadModel(spec: string): Promise<Model> {
  const { statistics, ballistics, files } = sharedFiles()
  // this file is built as .js and tested as .ts: the estimator has the same extension
  const here = fileURLToPath(import.meta.url)
  const cli = dirname(here)
  // A candidate may call the core model, so its version includes the core model's files too.
  const coreModel = [
    ...files,
    // with the integrator, the standard atmosphere and the options bag it imports by relative paths
    ...closure(join(ballistics, 'interior/model.js'), ballistics, 'ballistics'),
    // the bisection of the model's start and its grain forms
    ...closure(join(statistics, 'bisect.js'), statistics, 'statistics'),
    // the estimator of a powder not in the fitted set, unused by the runs, kept so the published versions stay valid
    ...closure(join(cli, `unseen${extname(here)}`), cli, 'cli'),
  ]
  if (spec === builtInName) return { name: spec, interior, files: coreModel }
  const path = resolve(spec)
  if (!existsSync(path))
    throw new UsageError(`the model ${spec} is neither "${builtInName}" nor a file`)
  let loaded: { interior?: unknown }
  try {
    loaded = (await import(pathToFileURL(path).href)) as { interior?: unknown }
  } catch (error) {
    const cause = String(error instanceof Error ? error.message : error).split('\n')[0]
    throw new UsageError(`the model module ${spec} cannot be loaded: ${cause}`)
  }
  if (typeof loaded.interior !== 'function')
    throw new UsageError(`the model module ${spec} exports no function "interior"`)
  const candidate = loaded.interior as InteriorModel
  return {
    name: spec,
    // a throw of the candidate is bad input, not an internal error; its refusal stays a refused row
    interior: (...args) => {
      try {
        return candidate(...args)
      } catch (error) {
        if (error instanceof InputError) throw error
        const cause = String(error instanceof Error ? error.message : error).split('\n')[0]
        throw new UsageError(`the model module ${spec} threw: ${cause}`)
      }
    },
    files: [...coreModel, ...closure(path, dirname(path), 'candidate')],
  }
}
