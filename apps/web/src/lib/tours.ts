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
      text: msg('Each open load has a tab. Saved loads lists the loads kept in this browser.'),
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
      text: msg('Runs the simulation in this browser.'),
    },
    {
      target: '.workspace-results, .workspace-tablist',
      title: msg('Results'),
      text: msg(
        'Simulated velocity, peak pressure with its range over the input tolerances, and the trajectory. Results are simulations, not load data.',
      ),
    },
    {
      // the menu itself has no box in the page bar: its Open button, not the disabled placeholder;
      // below 75em the closed Page actions panel hides it, so its toggle
      target: '.file-menu button:not(:disabled), .page-bar-toggle',
      title: msg('File'),
      text: msg(
        'Save writes the load to a file and keeps a copy in this browser; Open reads a load file.',
      ),
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
        'Mean, spread and other statistics of each string. Load example reads three made-up strings.',
      ),
    },
  ],
  // one tour for every record page: the parts a kind lacks are left out as not shown
  record: [
    {
      target: '.record-figure',
      title: msg('Figure'),
      text: msg('The record drawn or charted from its values.'),
    },
    {
      target: '.record-values',
      title: msg('Values'),
      text: msg('In the units chosen under Units.'),
    },
    {
      target: '.record-side',
      title: msg('Notes'),
      text: msg('Further values and notes.'),
    },
    {
      target: '.record-sources',
      title: msg('Sources'),
      text: msg('Each source of the values, with its origin and retrieval date.'),
    },
    {
      target: '.page-bar-actions, .page-bar-toggle',
      title: msg('Actions'),
      text: msg('Use the record in another page, copy its link or print it.'),
    },
  ],
  groups: [
    {
      target: '.target-toolbar',
      title: msg('Tools'),
      text: msg(
        'Photo adds a photo of the target; it stays in this browser. Calibrate sets its scale from a reference of known size. Shot places shots.',
      ),
    },
    {
      target: '.target-stage',
      title: msg('Target'),
      text: msg('The photo or the drawn target with the shots of each group.'),
    },
    {
      target: '.stats-side, .target-tabs, .target-sheet',
      title: msg('Statistics'),
      text: msg(
        'ES, mean radius and the other statistics of the chosen group, with its shots. In a narrow window they are under Stats; on a phone, open the strip at the bottom first.',
      ),
    },
    {
      target: '.file-menu button:not(:disabled), .page-bar-toggle',
      title: msg('File'),
      text: msg(
        'The sheet is kept in this browser. Save writes it to a file; Open reads a sheet file.',
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
