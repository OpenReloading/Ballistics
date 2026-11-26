// Splits the compiled English catalog by source module: each module loads its own with `loadEnglish`, so a page carries only the English it shows
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getCatalogs } from '@lingui/cli/api'
import { getConfig } from '@lingui/conf'

const root = path.join(import.meta.dirname, '..')

/** The path, relative to `src/`, of a module's English catalog: `src/locales/en/<module without extension>.json`. */
const catalogOf = (module: string) =>
  `locales/en/${path.relative('src', module).replace(/\.[cm]?[jt]sx?$/, '')}.json`

/** The ids of each module of `origins`, by the modules that write them. */
function idsByModule(origins: Record<string, { origin?: [string, number?][] }>) {
  const byModule = new Map<string, string[]>()
  for (const [id, { origin = [] }] of Object.entries(origins))
    for (const module of new Set(origin.map(([file]) => file)))
      byModule.set(module, [...(byModule.get(module) ?? []), id])
  return byModule
}

/** Each import of an English catalog in `src/`: the importing file, the catalog as an absolute path, and whether the file passes it to `loadEnglish`. */
const imports = readdirSync(path.join(root, 'src'), { recursive: true, withFileTypes: true })
  .filter((f) => f.isFile() && /\.tsx?$/.test(f.name))
  .flatMap((f) => {
    const file = path.join(f.parentPath, f.name)
    const text = readFileSync(file, 'utf8')
    const loaded = new Set(
      [...text.matchAll(/loadEnglish\(([^)]*)\)/g)].flatMap((m) =>
        (m[1] as string).split(',').map((name) => name.trim()),
      ),
    )
    return [...text.matchAll(/import (\w+) from '(\.[^']*\/locales\/en\/[^']+\.json)'/g)].map(
      ([, name, catalog]) => ({
        file: path.relative(root, file),
        catalog: path.resolve(f.parentPath, catalog as string),
        loaded: loaded.has(name as string),
      }),
    )
  })

const config = getConfig({ cwd: root, configPath: path.join(root, 'lingui.config.ts') })
const [views] = await getCatalogs(config)
const extracted = await views?.collect()
// Lingui returns no catalog when it cannot extract a file, after printing why
if (extracted === undefined) {
  console.error('lingui could not extract the messages of src/')
  process.exit(1)
}
const compiled = JSON.parse(readFileSync(path.join(root, 'src/locales/en.json'), 'utf8')) as {
  messages: Record<string, unknown>
}
const written = new Set<string>()
for (const [module, ids] of idsByModule(extracted)) {
  const file = path.join(root, 'src', catalogOf(module))
  mkdirSync(path.dirname(file), { recursive: true })
  const messages = Object.fromEntries(ids.sort().map((id) => [id, compiled.messages[id]]))
  const uncompiled = ids.filter((id) => messages[id] === undefined)
  if (uncompiled.length > 0) {
    console.error(
      `${module}: ${uncompiled.join(', ')} not in src/locales/en.po; run lingui extract`,
    )
    process.exitCode = 1
  }
  writeFileSync(file, JSON.stringify({ messages }))
  written.add(file)
  if (!imports.some((i) => i.catalog === file)) {
    console.error(
      `${module}: load its English with loadEnglish from '${path.relative(path.dirname(path.join(root, module)), file)}' there, or for a module of a worker in the module that shows its messages`,
    )
    process.exitCode = 1
  }
}
// a catalog left over from an earlier run would still resolve here, but not on a fresh checkout
for (const { file, catalog, loaded } of imports) {
  if (!written.has(catalog)) {
    console.error(
      `${file}: ${path.relative(root, catalog)} has no messages any more; remove its import and loadEnglish`,
    )
    process.exitCode = 1
  } else if (!loaded) {
    console.error(`${file}: pass ${path.relative(root, catalog)} to loadEnglish`)
    process.exitCode = 1
  }
}
