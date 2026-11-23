import { expect, it } from 'vitest'
import { editionFallback, withNextDispatch } from '../src/root-not-found.ts'

it('hands a miss under next/ to the next edition and any other miss to stable', () => {
  expect(editionFallback('/next/x/', '', false)).toBe('/next/404.edition.html')
  expect(editionFallback('/x/', '', false)).toBe('/404.edition.html')
  expect(editionFallback('/Ballistics/next/cartridges/x/', '/Ballistics', false)).toBe(
    '/Ballistics/next/404.edition.html',
  )
  expect(editionFallback('/ballistics/next/x', '/Ballistics', false)).toBe(
    '/Ballistics/next/404.edition.html',
  )
  expect(editionFallback('/Ballistics/nextish/', '/Ballistics', false)).toBe(
    '/Ballistics/404.edition.html',
  )
  // GitHub Pages redirects the folder without its slash, so this path never reaches next/
  expect(editionFallback('/Ballistics/next', '/Ballistics', false)).toBe(
    '/Ballistics/404.edition.html',
  )
})

it('leaves stable misses alone when only next/ is handed over', () => {
  expect(editionFallback('/Ballistics/x/', '/Ballistics', true)).toBeUndefined()
  expect(editionFallback('/Ballistics/nextish/', '/Ballistics', true)).toBeUndefined()
  expect(editionFallback('/x/', '', true)).toBeUndefined()
  expect(editionFallback('/Ballistics/next/x/', '/Ballistics', true)).toBe(
    '/Ballistics/next/404.edition.html',
  )
})

it('inserts the script once, right after the charset element', () => {
  const page = withNextDispatch(
    '<!DOCTYPE html><html><head><meta charSet="utf-8"/><link rel="preload" href="/a.js"/></head></html>',
    '/Ballistics',
  )
  expect(page.startsWith('<!DOCTYPE html><html><head><meta charSet="utf-8"/><script>')).toBe(true)
  expect(page.endsWith('</script><link rel="preload" href="/a.js"/></head></html>')).toBe(true)
  expect(page.match(/<script>/g)).toHaveLength(1)
})

it('throws on a page without a charset element or with two', () => {
  expect(() => withNextDispatch('<html><head></head></html>', '')).toThrow()
  expect(() =>
    withNextDispatch('<head><meta charset="utf-8"><meta charSet="utf-8"/></head>', ''),
  ).toThrow()
})
