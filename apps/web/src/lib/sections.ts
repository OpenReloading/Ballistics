/** A tab of a library page: another route of it, listed in the page's tab bar. */
export interface LibraryTab {
  href: string
  label: string
  description: string
}

/** A page of the sidebar, drawer, search and home cards. */
interface PageEntry {
  href: string
  label: string
  /** The icon's name in `nav-icons.tsx`. */
  icon: string
  description: string
  /** The routes the page shows as tabs; the first is `href`, and each is current under this page. */
  tabs?: readonly LibraryTab[]
  /** Routes under no tab that the page links to and that link back to it (`/federations`). */
  covers?: readonly string[]
}

/** The catalogue lists, read-only records each with its sources. */
export const databaseTabs: readonly LibraryTab[] = [
  {
    href: '/cartridges',
    label: 'Cartridges',
    description: 'CIP dimensions, drawings and maximum pressures, each with its source document.',
  },
  {
    href: '/bullets',
    label: 'Bullets',
    description: 'Diameters, masses, lengths and ballistic coefficients, each with its source.',
  },
  {
    href: '/powders',
    label: 'Powders',
    description: 'Propellants and their recorded properties, each with its sources.',
  },
  {
    href: '/cases',
    label: 'Cases',
    description:
      'Cartridge case products with material, primer pocket and stated water capacity, each with its sources.',
  },
  {
    href: '/targets',
    label: 'Targets',
    description:
      'Rule-book target faces: ring diameters, black area and the disciplines shot on them, each with its source.',
  },
  {
    href: '/disciplines',
    label: 'Disciplines',
    description:
      'Rule-book disciplines and their federations: distance, caliber classes and the faces they are shot on, each with its source.',
  },
]

/** What the user owns or measured, kept in this browser and in files. */
export const gearTabs: readonly LibraryTab[] = [
  {
    href: '/firearms',
    label: 'Firearms',
    description:
      'Your firearms with their optics and zeros; they fill the rifle fields of the workbench.',
  },
  {
    href: '/my-cases',
    label: 'My cases',
    description:
      'Your groups of cases with their measured water capacity, trim length and neck wall; the workbench picks them.',
  },
]

/** Information architecture (two groups, tools first): the sidebar, drawer, search, home cards and not-found page read it. */
export const sections = [
  {
    title: 'Tools',
    pages: [
      {
        href: '/workbench',
        label: 'Load workbench',
        icon: '/workbench',
        description:
          'Cartridge, bullet, powder and firearm in one view, with simulated velocity, pressure compared against CIP limits, and the trajectory in your browser.',
      },
      {
        href: '/session',
        label: 'Session summary',
        icon: '/session',
        description:
          'Shots and statistics per string from a chronograph export, read in your browser.',
      },
      {
        href: '/groups',
        label: 'Shot groups',
        icon: '/groups',
        description:
          'Group size and dispersion from a target photo or a drawn target; the photo stays in your browser.',
      },
    ],
  },
  {
    title: 'Library',
    pages: [
      {
        href: '/cartridges',
        label: 'Database',
        icon: 'database',
        description:
          'The published records, each with its source: cartridges, bullets, powders, cases, target faces and disciplines.',
        tabs: databaseTabs,
        covers: ['/federations'],
      },
      {
        href: '/firearms',
        label: 'My gear',
        icon: 'my-gear',
        description:
          'What you own or measured, kept in this browser and in files: your firearms with their optics and zeros, and your groups of cases.',
        tabs: gearTabs,
      },
    ],
  },
] as const satisfies readonly { title: string; pages: readonly PageEntry[] }[]

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

/** The route without the trailing slash of the Pages edition's URLs (`trailingSlash`), `/` as is. */
export const routeOf = (pathname: string) => pathname.replace(/(.)\/$/, '$1')

const pages = sections.flatMap((s): readonly PageEntry[] => s.pages)

/**
 * Whether a listed page covers a route: its own route, one of its tabs, or a page under one of them
 * (`/bullets/designer` under the Bullets tab of the Database), without a link of its own in the
 * sidebar or drawer, and the routes it `covers`. The offline page answers for any page not stored,
 * so it belongs to none.
 */
export const pageCoversRoute = (href: string, route: string) => {
  const page = pages.find((p) => p.href === href)
  const roots = [href, ...(page?.tabs?.map((t) => t.href) ?? []), ...(page?.covers ?? [])]
  return route !== '/offline' && roots.some((r) => route === r || route.startsWith(`${r}/`))
}

/** The listed page whose tab bar shows on `route` (a tab's own route, no page under it), if any. */
export const libraryOf = (route: string) => pages.find((p) => p.tabs?.some((t) => t.href === route))
