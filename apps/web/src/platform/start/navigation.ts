import { useLocation, useRouter as useStartRouter } from '@tanstack/react-router'
import { useMemo } from 'react'

/** `next/navigation` in the Start build: the path below the base path. */
export const usePathname = () => useLocation({ select: (location) => location.pathname })

export function useSearchParams() {
  const search = useLocation({ select: (location) => location.searchStr })
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The methods the views call; `refresh` runs the loaders again. */
export function useRouter() {
  const router = useStartRouter()
  return useMemo(
    () => ({
      push: (href: string) => void router.navigate({ href }),
      replace: (href: string) => void router.navigate({ href, replace: true }),
      back: () => router.history.back(),
      refresh: () => void router.invalidate(),
    }),
    [router],
  )
}
