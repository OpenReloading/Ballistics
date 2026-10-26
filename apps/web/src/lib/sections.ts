/** Information architecture (two groups, tools first): the sidebar, drawer, search, home cards and not-found page read it. */
export const sections = [
  {
    title: 'Tools',
    pages: [
      {
        href: '/workbench',
        label: 'Load workbench',
        description:
          'Cartridge, bullet, powder and firearm in one view, with simulated velocity, pressure compared against CIP limits, and the trajectory in your browser.',
      },
      {
        href: '/session',
        label: 'Session summary',
        description:
          'Shots and statistics per string from a chronograph export, read in your browser.',
      },
      {
        href: '/groups',
        label: 'Shot groups',
        description:
          'Group size and dispersion from a target photo or a drawn target; the photo stays in your browser.',
      },
    ],
  },
  {
    title: 'Data',
    pages: [
      {
        href: '/cartridges',
        label: 'Cartridges',
        description:
          'CIP dimensions, drawings and maximum pressures, each with its source document.',
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
      {
        href: '/firearms',
        label: 'Firearms',
        description:
          'Your firearms with their optics and zeros, kept in this browser and in files; they fill the rifle fields of the workbench.',
      },
    ],
  },
] as const

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

/** Pages without a link of their own that a listed page links to and that link back to it. */
const linkedFrom: Record<string, string> = { '/federations': '/disciplines' }

/**
 * Whether a listed page covers a route: the page itself, or a page under it that it links to and
 * that links back to it (`/bullets/designer` under `/bullets`, `linkedFrom`), without a link of its
 * own in the sidebar or drawer. The offline page answers for any page not stored, so it belongs to none.
 */
export const pageCoversRoute = (href: string, route: string) => {
  const under = (page: string) => route === page || route.startsWith(`${page}/`)
  return (
    route !== '/offline' &&
    (under(href) || Object.entries(linkedFrom).some(([page, from]) => from === href && under(page)))
  )
}
