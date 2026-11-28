import { globSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')

/** The TypeDoc site of every package with a typedoc.json; its Docs link is the site root (`DOCS_BASE_URL`, as docusaurus.config.ts). */
export default {
  entryPointStrategy: 'packages',
  entryPoints: globSync('packages/*/typedoc.json', { cwd: root })
    .map((file) => join(root, dirname(file)))
    .sort(),
  name: 'RangeFoundry Workbench library',
  readme: 'library.md',
  out: 'static/library',
  disableSources: true,
  navigationLinks: { Docs: process.env.DOCS_BASE_URL ?? '/' },
}
