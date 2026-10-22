import { globSync } from 'node:fs'
import { expect, it } from 'vitest'
import { isToolRoute, pageCoversRoute, sections, toolRoutes } from '../src/lib/sections.ts'

const hrefs: string[] = sections.flatMap((s) => s.pages.map((p) => p.href))

it('lists the two groups in order: Tools, Data', () => {
  expect(sections.map((s) => s.title)).toEqual(['Tools', 'Data'])
  expect(sections[0].pages.map((p) => p.href)).toEqual(['/workbench', '/session', '/groups'])
  expect(sections[1].pages.map((p) => p.href)).toEqual([
    '/cartridges',
    '/bullets',
    '/powders',
    '/targets',
    '/disciplines',
    '/firearms',
  ])
  // Settings is a dialog, no page
  expect(hrefs).not.toContain('/settings')
})

const routes = globSync('**/page.tsx', { cwd: new URL('../src/app', import.meta.url) })
  .map((f) => `/${f.replace(/\/?page\.tsx$/, '')}`)
  .filter((r) => r !== '/' && !r.includes('['))

it('holds every static page route once, and no other; a page under a listed page is covered by it', () => {
  expect([...hrefs].sort()).toEqual(routes.filter((r) => hrefs.includes(r)).sort())
  for (const r of routes.filter((r) => r !== '/offline'))
    expect(hrefs.filter((h) => pageCoversRoute(h, r)).length, r).toBeGreaterThan(0)
})

it('marks no page current on the offline page, which answers for any page not stored', () => {
  expect(hrefs.filter((h) => pageCoversRoute(h, '/offline'))).toEqual([])
  expect(pageCoversRoute('/workbench', '/workbench')).toBe(true)
})

it('marks Disciplines current on the federation pages it links to', () => {
  expect(hrefs.filter((h) => pageCoversRoute(h, '/federations/dsb'))).toEqual(['/disciplines'])
})

it('names existing routes as tool pages, the workbench, the shot groups and the designers', () => {
  for (const r of toolRoutes) expect(routes).toContain(r)
  expect(isToolRoute('/cartridges')).toBe(false)
})

it('covers each designer by its database list, not by a link of its own', () => {
  for (const list of ['/bullets', '/cartridges']) {
    expect(routes).toContain(`${list}/designer`)
    expect(hrefs).not.toContain(`${list}/designer`)
    expect(pageCoversRoute(list, `${list}/designer`)).toBe(true)
  }
  expect(pageCoversRoute('/bullets', '/bulletsx')).toBe(false)
})
