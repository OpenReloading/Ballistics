import { msg } from '../i18n/translate.ts'

/** The sections of the workbench report a reader can leave out, in the order the report prints them. */
export const printSections = [
  { key: 'inputs', label: msg('Inputs') },
  { key: 'chart', label: msg('Chart') },
  { key: 'ladder', label: msg('Ladder') },
  { key: 'barrel', label: msg('Barrel length study') },
  { key: 'limits', label: msg('Pressure limits') },
  { key: 'notes', label: msg('Notes') },
] as const

export type PrintSection = (typeof printSections)[number]['key']

/** Which sections print; every one by default, as the report printed before the choice. */
export type PrintChoice = Readonly<Record<PrintSection, boolean>>

export const allSections: PrintChoice = Object.fromEntries(
  printSections.map((s) => [s.key, true]),
) as PrintChoice

/** The browser storage key of the choice. */
export const printSectionsKey = 'workbench-print-sections'

/**
 * The stored choice read leniently: a section the text does not name as `false` prints, so a
 * section added later prints until it is unticked, and unreadable text prints them all.
 */
export function parsePrintChoice(text: string | null | undefined): PrintChoice {
  if (!text) return allSections
  try {
    const stored: unknown = JSON.parse(text)
    if (typeof stored !== 'object' || stored === null) return allSections
    const off = stored as Record<string, unknown>
    return Object.fromEntries(
      printSections.map((s) => [s.key, off[s.key] !== false]),
    ) as PrintChoice
  } catch {
    return allSections
  }
}

/** The sections left out, for the stored text and the print rules: "chart notes". */
export const omittedSections = (choice: PrintChoice) =>
  printSections
    .filter((s) => !choice[s.key])
    .map((s) => s.key)
    .join(' ')
