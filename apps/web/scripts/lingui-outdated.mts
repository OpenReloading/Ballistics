// Fails when an English text of a catalog of src/locales changed after its German entry was written: apps/docs/docs/translating.md
import { catalogs, type PoCatalog, readCatalog } from './po-catalog.mts'

const notePrefix = 'en: '

/** `comments` with the `# en: "<English>"` note that records the English text a German entry translates. */
export const withSourceNote = (comments: readonly string[], english: string) => [
  ...comments.filter((c) => !c.startsWith(notePrefix)),
  `${notePrefix}${JSON.stringify(english)}`,
]

const notedEnglish = (comments: readonly string[]) => {
  const note = comments.find((c) => c.startsWith(notePrefix))
  return note === undefined ? undefined : (JSON.parse(note.slice(notePrefix.length)) as string)
}

/** The German entries whose note is missing (`noted` undefined) or names other English than `en` holds now. */
export function outdated(en: PoCatalog, de: PoCatalog) {
  return Object.entries(de).flatMap(([id, entry]) => {
    if (entry.obsolete || !entry.translation) return []
    const english = en[id]?.translation
    const noted = notedEnglish(entry.extra?.translatorComments ?? [])
    return noted === english ? [] : [{ id, noted, english }]
  })
}

const lineOf = ({ id, noted, english }: ReturnType<typeof outdated>[number]) =>
  noted === undefined
    ? `${id}: no "# ${notePrefix}" note of the English it translates`
    : `${id}: written for ${JSON.stringify(noted)}, the English is now ${JSON.stringify(english)}`

if (import.meta.main) {
  for (const catalog of catalogs) {
    const found = outdated(await readCatalog('en', catalog), await readCatalog('de', catalog))
    if (found.length > 0) {
      console.error(
        `${catalog.replace('<rootDir>/', '').replace('{locale}', 'de')}.po: check these against the English, then update the text and its note\n${found.map(lineOf).join('\n')}`,
      )
      process.exitCode = 1
    }
  }
}
