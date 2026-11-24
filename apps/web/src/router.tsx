import { createRouter } from '@tanstack/react-router'
import { PageError } from './routes/-error.tsx'
import { parseSearch, stringifySearch } from './routes/-search.ts'
import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  return createRouter({
    routeTree,
    // the default JSON search turns `?q=6.50` into `6.5` in an in-app link's `href` and in `searchStr`
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
