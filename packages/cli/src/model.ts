import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { interior } from '@open-reloading/core'
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

const importPattern = /(?:\bfrom|\bimport)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g

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

/** The built files the record to load step and the seating read, which every model version shares. */
function sharedFiles() {
  const core = dirname(fileURLToPath(import.meta.resolve('@open-reloading/core')))
  const drawing = dirname(
    dirname(fileURLToPath(import.meta.resolve('@open-reloading/drawing/seating'))),
  )
  return {
    core,
    files: [
      ...closure(join(core, 'interior/record-load.js'), core, 'core'),
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
  const { core, files } = sharedFiles()
  if (spec === builtInName)
    return {
      name: spec,
      interior,
      files: [...files, ...closure(join(core, 'interior/model.js'), core, 'core')],
    }
  const path = resolve(spec)
  if (!existsSync(path))
    throw new UsageError(`the model ${spec} is neither "${builtInName}" nor a file`)
  let loaded: { interior?: unknown }
  try {
    loaded = (await import(pathToFileURL(path).href)) as { interior?: unknown }
  } catch {
    throw new UsageError(`the model module ${spec} cannot be loaded`)
  }
  if (typeof loaded.interior !== 'function')
    throw new UsageError(`the model module ${spec} exports no function "interior"`)
  return {
    name: spec,
    interior: loaded.interior as InteriorModel,
    files: [...files, ...closure(path, dirname(path), 'candidate')],
  }
}
