import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  return createRouter({
    routeTree,
    trailingSlash: 'always',
    scrollRestoration: true,
    // plain query strings as Next writes and reads them, not the router's JSON values
    parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
    stringifySearch: (search) => {
      const s = new URLSearchParams(search as Record<string, string>).toString()
      return s ? `?${s}` : ''
    },
  })
}
