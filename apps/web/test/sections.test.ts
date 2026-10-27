import { globSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  databaseTabs,
  gearTabs,
  isToolRoute,
  libraryOf,
  pageCoversRoute,
  routeOf,
  sections,
  toolRoutes,
} from '../src/lib/sections.ts'

const hrefs: string[] = sections.flatMap((s) => s.pages.map((p) => p.href))

it('lists the two groups in order: Tools, Library, five pages in all', () => {
  expect(sections.map((s) => s.title)).toEqual(['Tools', 'Library'])
  expect(sections[0].pages.map((p) => p.href)).toEqual(['/workbench', '/session', '/groups'])
  expect(sections[1].pages.map((p) => p.label)).toEqual(['Database', 'My gear'])
  expect(databaseTabs.map((t) => t.href)).toEqual([
    '/cartridges',
    '/bullets',
    '/powders',
    '/cases',
    '/primers',
    '/targets',
    '/disciplines',
  ])
  expect(gearTabs.map((t) => t.href)).toEqual(['/firearms', '/my-cases'])
  // each library page opens on its first tab
  expect(sections[1].pages.map((p) => p.href)).toEqual(['/cartridges', '/firearms'])
  // Settings is a dialog, no page
  expect(hrefs).not.toContain('/settings')
})

const routes = globSync('**/page.tsx', { cwd: new URL('../src/app', import.meta.url) })
  .map((f) => `/${f.replace(/\/?page\.tsx$/, '')}`)
  .filter((r) => r !== '/' && !r.includes('['))

const listed = new Set([...hrefs, ...[...databaseTabs, ...gearTabs].map((t) => t.href)])

it('holds every static page route as a page or a tab, and each is covered by one page', () => {
  expect(new Set(routes.filter((r) => listed.has(r)))).toEqual(listed)
  for (const r of routes.filter((r) => r !== '/offline'))
    expect(hrefs.filter((h) => pageCoversRoute(h, r)).length, r).toBe(1)
})

it('marks no page current on the offline page, which answers for any page not stored', () => {
  expect(hrefs.filter((h) => pageCoversRoute(h, '/offline'))).toEqual([])
  expect(pageCoversRoute('/workbench', '/workbench')).toBe(true)
})

it('marks Database current on the federation pages and the burn-rate overlay it links to', () => {
  expect(hrefs.filter((h) => pageCoversRoute(h, '/federations/dsb'))).toEqual(['/cartridges'])
  expect(hrefs.filter((h) => pageCoversRoute(h, '/powders/burn-rates'))).toEqual(['/cartridges'])
})

it('keeps the two pages apart: My cases is My gear, not the Cases tab of the Database', () => {
  expect(hrefs.filter((h) => pageCoversRoute(h, '/my-cases'))).toEqual(['/firearms'])
  expect(hrefs.filter((h) => pageCoversRoute(h, '/cases/some-id'))).toEqual(['/cartridges'])
  expect(hrefs.filter((h) => pageCoversRoute(h, '/'))).toEqual([])
})

it('shows a tab bar on the route of a tab only, not on a record or a designer under it', () => {
  expect(libraryOf('/bullets')?.label).toBe('Database')
  expect(libraryOf('/my-cases')?.label).toBe('My gear')
  for (const r of ['/bullets/designer', '/cartridges/308-win', '/federations', '/workbench', '/'])
    expect(libraryOf(r), r).toBeUndefined()
})

it('names existing routes as tool pages, the workbench, the shot groups and the designers', () => {
  for (const r of toolRoutes) expect(routes).toContain(r)
  expect(isToolRoute('/cartridges')).toBe(false)
})

it('covers each designer by the Database, not by a link of its own', () => {
  for (const list of ['/bullets', '/cartridges', '/targets', '/powders']) {
    expect(routes).toContain(`${list}/designer`)
    expect(hrefs).not.toContain(`${list}/designer`)
    expect(pageCoversRoute('/cartridges', `${list}/designer`)).toBe(true)
  }
  expect(pageCoversRoute('/cartridges', '/bulletsx')).toBe(false)
})

it('names a Pages URL by its route: no trailing slash, the root as is', () => {
  expect(routeOf('/workbench/')).toBe('/workbench')
  expect(routeOf('/cartridges/308-win/')).toBe('/cartridges/308-win')
  expect(routeOf('/workbench')).toBe('/workbench')
  expect(routeOf('/')).toBe('/')
})
