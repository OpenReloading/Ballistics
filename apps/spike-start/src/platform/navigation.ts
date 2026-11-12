// Stands in for `next/navigation` on the router's hooks.
import { notFound, useLocation, useRouter as useTanStackRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { routerTarget } from './href.ts'

export { notFound }

export function usePathname() {
  return useLocation({ select: (l) => l.pathname })
}

export function useSearchParams() {
  const search = useLocation({ select: (l) => l.searchStr })
  return useMemo(() => new URLSearchParams(search), [search])
}

export function useRouter() {
  const router = useTanStackRouter()
  return useMemo(() => {
    const go = (href: string, replace: boolean) => {
      const t = routerTarget(href)
      if (t.external) {
        location.assign(href)
        return
      }
      void router.navigate({
        to: t.to as never,
        search: t.search as never,
        ...(t.hash && { hash: t.hash }),
        replace,
      })
    }
    return {
      push: (href: string) => go(href, false),
      replace: (href: string) => go(href, true),
      back: () => router.history.back(),
      forward: () => router.history.forward(),
      refresh: () => void router.invalidate(),
      prefetch: (href: string) => void router.preloadRoute({ to: routerTarget(href).to as never }),
    }
  }, [router])
}
