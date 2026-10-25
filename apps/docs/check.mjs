// Runs TypeDoc on every package without writing output: an undocumented export, a TypeDoc
// warning or an exported variable or function whose rendered type is too long (`scripts/type-length.mts`)
// fails the run.
// Needs the packages built first: the packages import each other's dist/.
import { join } from 'node:path'
import {
  Application,
  PackageJsonReader,
  ReflectionKind,
  TSConfigReader,
  TypeDocReader,
} from 'typedoc'
import { tooLong } from './scripts/type-length.mts'

const packages = ['schema', 'core', 'drawing', 'importers', 'data', 'api']
// the library's own generics, linked from the doc comment to the inferred type
const exempt = /^Zod/

/** The value type, return types and parameter types of a variable or function, by name. */
const typesOf = (r) => [
  ['type', r.type],
  ...(r.signatures ?? []).flatMap((s) => [
    ['returns', s.type],
    ...(s.parameters ?? []).map((p) => [`parameter ${p.name}`, p.type]),
  ]),
]

/** Each over-long type of a variable or function. */
const longTypes = (project) =>
  project
    .getReflectionsByKind(ReflectionKind.Variable | ReflectionKind.Function)
    .flatMap((r) => typesOf(r).map(([what, type]) => [r, what, type]))
    .filter(([, , type]) => type && !(type.type === 'reference' && exempt.test(type.name)))
    .map(([r, what, type]) => [r, what, type.toString()])
    .filter(([, , rendered]) => tooLong(rendered))
    .map(([r, what, rendered]) => `${r.getFullName()} ${what}: ${rendered.length} characters`)

let failed = false
for (const name of packages) {
  const dir = join(import.meta.dirname, '..', '..', 'packages', name)
  console.log(`typedoc @open-reloading/${name}`)
  process.chdir(dir)
  // the check writes nothing, so no source links: a clone without a git remote passes too
  const app = await Application.bootstrapWithPlugins(
    { options: join(dir, 'typedoc.json'), disableSources: true },
    [new TypeDocReader(), new PackageJsonReader(), new TSConfigReader()],
  )
  const project = await app.convert()
  if (project) app.validate(project)
  // treatWarningsAsErrors in typedoc.json: TypeDoc's CLI fails on any warning, and so does this
  if (!project || app.logger.hasErrors() || app.logger.hasWarnings()) failed = true
  for (const line of project ? longTypes(project) : []) {
    console.error(`long type: ${line}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
