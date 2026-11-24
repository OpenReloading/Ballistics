import { createRouter } from '@tanstack/react-router'
import { PageError } from './routes/-error.tsx'
import { parseSearch, stringifySearch } from './routes/-search.ts'
import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  return createRouter({
    routeTree,
    // the default JSON search turns `?q=6.50` into `?q=6.5` in the address on load
    parseSearch,
    stringifySearch,
    trailingSlash: 'always',
    scrollRestoration: true,
    defaultErrorComponent: PageError,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
