// Reads and writes the Lingui catalogs of src/locales with the formatter `lingui extract` uses, so a write keeps their form
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { CatalogType } from '@lingui/conf'
import { format } from '../lingui.config.ts'

/** What the PO formatter keeps beside a message: the `#` translator comments and the `#,` flags. */
export type PoCatalog = CatalogType<{ translatorComments: string[]; flags: string[] }>

const fileOf = (locale: string) =>
  path.join(import.meta.dirname, '..', 'src', 'locales', `${locale}.po`)

const contextOf = (locale: string) => ({ locale, sourceLocale: 'en', filename: fileOf(locale) })

export async function readCatalog(locale: string) {
  const catalog = await format.parse(readFileSync(fileOf(locale), 'utf8'), contextOf(locale))
  // the PO formatter sets both lists on every message it parses
  return catalog as PoCatalog
}

export async function writeCatalog(locale: string, catalog: PoCatalog) {
  const existing = readFileSync(fileOf(locale), 'utf8')
  writeFileSync(fileOf(locale), await format.serialize(catalog, { ...contextOf(locale), existing }))
}
