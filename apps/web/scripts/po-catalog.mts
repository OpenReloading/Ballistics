// Reads and writes the Lingui catalogs of src/locales with the formatter `lingui extract` uses, so a write keeps their form
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { CatalogType } from '@lingui/conf'
import config, { format } from '../lingui.config.ts'

/** What the PO formatter keeps beside a message: the `#` translator comments and the `#,` flags. */
export type PoCatalog = CatalogType<{ translatorComments: string[]; flags: string[] }>

/** The `path` of each catalog of `lingui.config.ts`. */
export const catalogs = (config.catalogs ?? []).map((c) => c.path)

const fileOf = (locale: string, catalog: string) =>
  `${catalog.replace('<rootDir>', path.join(import.meta.dirname, '..')).replace('{locale}', locale)}.po`

const contextOf = (locale: string, catalog: string) => ({
  locale,
  sourceLocale: 'en',
  filename: fileOf(locale, catalog),
})

export async function readCatalog(locale: string, catalog: string) {
  const context = contextOf(locale, catalog)
  const parsed = await format.parse(readFileSync(context.filename, 'utf8'), context)
  // the PO formatter sets both lists on every message it parses
  return parsed as PoCatalog
}

export async function writeCatalog(locale: string, catalog: string, messages: PoCatalog) {
  const context = contextOf(locale, catalog)
  const existing = readFileSync(context.filename, 'utf8')
  writeFileSync(context.filename, await format.serialize(messages, { ...context, existing }))
}
