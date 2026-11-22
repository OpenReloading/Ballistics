import type { MessageDescriptor } from '@lingui/core'
import type { FileRouteTypes } from '../routeTree.gen.ts'

/** Every route without a parameter but home. */
export type StaticRoute = Exclude<FileRouteTypes['to'], '/' | '/$' | `${string}/$id`>

/** The title of each static route: a route without one, or a title without a route, fails tsc. */
export const pageTitles = {
  '/bullets': /*i18n*/ { id: 'page.bullets', message: 'Bullets' },
  '/bullets/compare': /*i18n*/ { id: 'page.bulletsCompare', message: 'Compare bullets' },
  '/bullets/designer': /*i18n*/ { id: 'page.bulletsDesigner', message: 'Bullet designer' },
  '/cartridges': /*i18n*/ { id: 'page.cartridges', message: 'Cartridges' },
  '/cartridges/designer': /*i18n*/ { id: 'page.cartridgesDesigner', message: 'Cartridge designer' },
  '/cases': /*i18n*/ { id: 'page.cases', message: 'Brass' },
  '/cases/editor': /*i18n*/ { id: 'page.casesEditor', message: 'Brass group' },
  '/disciplines': /*i18n*/ { id: 'page.disciplines', message: 'Disciplines' },
  '/events': /*i18n*/ { id: 'page.events', message: 'Competition events' },
  '/federations': /*i18n*/ { id: 'page.federations', message: 'Federations' },
  '/firearms': /*i18n*/ { id: 'page.firearms', message: 'Firearms' },
  '/firearms/log': /*i18n*/ { id: 'page.firearmsLog', message: 'Shooting log' },
  '/groups': /*i18n*/ { id: 'page.groups', message: 'Shot groups' },
  '/offline': /*i18n*/ { id: 'page.offline', message: 'Offline' },
  '/powders': /*i18n*/ { id: 'page.powders', message: 'Powders' },
  '/powders/burn-rates': /*i18n*/ { id: 'page.powdersBurnRates', message: 'Powder burn rates' },
  '/powders/designer': /*i18n*/ { id: 'page.powdersDesigner', message: 'Powder designer' },
  '/powders/tune': /*i18n*/ { id: 'page.powdersTune', message: 'Tune a powder' },
  '/primers': /*i18n*/ { id: 'page.primers', message: 'Primers' },
  '/range': /*i18n*/ { id: 'page.range', message: 'Range mode' },
  '/session': /*i18n*/ { id: 'page.session', message: 'Session summary' },
  '/targets': /*i18n*/ { id: 'page.targets', message: 'Targets' },
  '/targets/designer': /*i18n*/ { id: 'page.targetsDesigner', message: 'Target designer' },
  '/workbench': /*i18n*/ { id: 'page.workbench', message: 'Load workbench' },
} satisfies Record<StaticRoute, MessageDescriptor>

// the paths as the site serves them, with the trailing slash
export const staticPaths = Object.keys(pageTitles).map((route) => `${route}/`)
