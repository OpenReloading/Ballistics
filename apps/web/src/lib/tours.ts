import { type Message, msg } from '../i18n/translate.ts'
import { storageName } from './edition.ts'

/**
 * One step of a page tour: the element it points at (CSS selectors, the first one shown is taken,
 * so a phone layout can name its own) and its short text.
 */
export type TourStep = { target: string; title: Message; text: Message }

/** The tours of the pages that have one, by page. */
export const tours = {
  workbench: [
    {
      target: '.load-strip',
      title: msg('Loads'),
      text: msg(
        'Each open load has a tab. New load starts another; the list holds the saved ones.',
      ),
    },
    {
      target: '.workspace-inputs',
      title: msg('Load'),
      text: msg(
        'Choose the cartridge, bullet, powder and firearm and enter the charge. Empty fields take the record values.',
      ),
    },
    {
      target: '.bar-run, .workspace-bar',
      title: msg('Run'),
      text: msg('Runs the simulation in this browser with the values entered.'),
    },
    {
      target: '.workspace-results, .workspace-tablist',
      title: msg('Results'),
      text: msg(
        'Simulated velocity, peak pressure with its range over the input tolerances, and the trajectory. Results are simulations, not load data.',
      ),
    },
    {
      // the menu itself has no box in the page bar: its Open button
      target: '.file-menu button',
      title: msg('File'),
      text: msg('Save keeps the load in this browser; Open reads a load file.'),
    },
  ],
  session: [
    {
      target: '.session-import',
      title: msg('Chronograph file'),
      text: msg(
        'Choose the file your chronograph wrote; it is read in this browser. The unit applies when the file gives none.',
      ),
    },
    {
      target: '.sheet',
      title: msg('Summary'),
      text: msg(
        'Once a file is read: mean, spread and the other statistics of each string. Load example reads three made-up strings.',
      ),
    },
  ],
} as const satisfies Record<string, readonly TourStep[]>

/** A page that has a tour. */
export type TourPage = keyof typeof tours

/** `localStorage` key of the pages whose tour the viewer has seen, one page name per line. */
const toursSeenKey = storageName('toursSeen')

/** The pages a stored value names. */
export const parseSeen = (text: string | null) => new Set(text?.split('\n').filter(Boolean))

/** Whether the viewer has seen the tour of `page`; without storage, not seen. */
export function tourSeen(page: TourPage) {
  try {
    return parseSeen(localStorage.getItem(toursSeenKey)).has(page)
  } catch {
    return false
  }
}

/** Stores that the viewer has seen the tour of `page`. */
export function markTourSeen(page: TourPage) {
  try {
    const seen = parseSeen(localStorage.getItem(toursSeenKey)).add(page)
    localStorage.setItem(toursSeenKey, [...seen].join('\n'))
  } catch {
    // shortcut: without storage the tour shows as not seen after a reload
  }
}
