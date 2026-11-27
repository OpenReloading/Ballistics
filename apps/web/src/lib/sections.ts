import type { MessageDescriptor } from '@lingui/core'
import { type Message, msg } from '../i18n/translate.ts'

/** A tab of a library page: another route of it, listed in the page's tab bar. */
interface LibraryTab {
  href: string
  label: MessageDescriptor
  description: Message
}

/** A page of the sidebar, drawer, search and home cards. */
export interface PageEntry {
  href: string
  label: MessageDescriptor
  /** The icon's name in `nav-icons.tsx`. */
  icon: string
  description: MessageDescriptor
  /** The routes the page shows as tabs, in the tab bar's order; each is current under this page. */
  tabs?: readonly LibraryTab[]
  /** Routes under no tab that the page links to and that link back to it (`/events`). */
  covers?: readonly string[]
}

/** The lists of the Database: catalogue records each with its sources, and the user's own records next to them. */
export const databaseTabs: readonly LibraryTab[] = [
  {
    href: '/firearms',
    label: /*i18n*/ { id: 'page.firearms', message: 'Firearms' },
    description: msg(
      "Your firearms with their optics and zeros, kept in this browser; they fill the workbench's firearm fields.",
    ),
  },
  {
    href: '/cartridges',
    label: /*i18n*/ { id: 'page.cartridges', message: 'Cartridges' },
    description: msg('CIP dimensions, drawings and maximum pressures.'),
  },
  {
    href: '/cases',
    label: /*i18n*/ { id: 'page.cases', message: 'Brass' },
    description: msg(
      'Cartridge case products with material, primer pocket and stated water capacity.',
    ),
  },
  {
    href: '/primers',
    label: /*i18n*/ { id: 'page.primers', message: 'Primers' },
    description: msg('Primer products with size, cup and priming compound.'),
  },
  {
    href: '/powders',
    label: /*i18n*/ { id: 'page.powders', message: 'Powders' },
    description: msg('Propellants and their recorded properties.'),
  },
  {
    href: '/bullets',
    label: /*i18n*/ { id: 'page.bullets', message: 'Bullets' },
    description: msg('Diameters, masses, lengths and ballistic coefficients.'),
  },
  {
    href: '/targets',
    label: /*i18n*/ { id: 'page.targets', message: 'Targets' },
    description: msg(
      'Rule-book targets: ring diameters, black area and the disciplines shot on them.',
    ),
  },
  {
    href: '/disciplines',
    label: /*i18n*/ { id: 'page.disciplines', message: 'Disciplines' },
    description: msg('Rule-book disciplines: federation, distance, caliber classes and targets.'),
  },
  {
    href: '/federations',
    label: /*i18n*/ { id: 'page.federations', message: 'Federations' },
    description: msg(
      'Shooting federations and the rule books their disciplines and targets come from.',
    ),
  },
]

/** Information architecture (two groups, tools first): the sidebar, drawer, search, home cards and not-found page read it, each loading its English (`locales/en/lib/sections.json`), as the e2e specs import this module outside the app. */
export const sections = [
  {
    title: /*i18n*/ { id: 'sections.tools', message: 'Tools' },
    pages: [
      {
        href: '/workbench',
        label: /*i18n*/ { id: 'page.workbench', message: 'Load workbench' },
        icon: '/workbench',
        description: /*i18n*/ {
          id: 'sections.workbench.about',
          message:
            'Simulated velocity, pressure against CIP limits and trajectory for your cartridge, bullet, powder and firearm, computed in your browser.',
        },
      },
      {
        href: '/session',
        label: /*i18n*/ { id: 'page.session', message: 'Session summary' },
        icon: '/session',
        description: /*i18n*/ {
          id: 'sections.session.about',
          message:
            'Shots and statistics per string from a chronograph export, read in your browser.',
        },
        covers: ['/range'],
      },
      {
        href: '/groups',
        label: /*i18n*/ { id: 'page.groups', message: 'Shot groups' },
        icon: '/groups',
        description: /*i18n*/ {
          id: 'sections.groups.about',
          message:
            'Group size and dispersion from a target photo or a drawn target; the photo stays in your browser.',
        },
      },
    ],
  },
  {
    title: /*i18n*/ { id: 'sections.library', message: 'Library' },
    pages: [
      {
        href: '/cartridges',
        label: /*i18n*/ { id: 'sections.database', message: 'Database' },
        icon: 'database',
        description: /*i18n*/ {
          id: 'sections.database.about',
          message: 'The published records, each with its source, and your own beside them.',
        },
        tabs: databaseTabs,
        covers: ['/events'],
      },
    ],
  },
] as const satisfies readonly { title: MessageDescriptor; pages: readonly PageEntry[] }[]

/** Tool pages: no reading measure on their text; every other page is a document page. */
export const toolRoutes = [
  '/workbench',
  '/groups',
  '/bullets/designer',
  '/cartridges/designer',
  '/targets/designer',
  '/powders/designer',
]

export const isToolRoute = (route: string) => toolRoutes.includes(route)

/** The route without the trailing slash of the static site's URLs (`trailingSlash`), `/` as is. */
export const routeOf = (pathname: string) => pathname.replace(/(.)\/$/, '$1')

const pages = sections.flatMap((s): readonly PageEntry[] => s.pages)

/** Pages without a sidebar link of their own count under their tab; the offline page answers for any page, so it belongs to none. */
export const pageCoversRoute = (href: string, route: string) => {
  const page = pages.find((p) => p.href === href)
  const roots = [href, ...(page?.tabs?.map((t) => t.href) ?? []), ...(page?.covers ?? [])]
  return route !== '/offline' && roots.some((r) => route === r || route.startsWith(`${r}/`))
}

/** The listed page whose tab bar shows on `route` (a tab's own route, no page under it), if any. */
export const libraryOf = (route: string) => pages.find((p) => p.tabs?.some((t) => t.href === route))
