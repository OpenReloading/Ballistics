import { useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, MouseEvent, Ref } from 'react'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  ref?: Ref<HTMLAnchorElement>
  replace?: boolean
  prefetch?: boolean | null
  onNavigate?: (event: { preventDefault: () => void }) => void
}

// Vite's base, as basePath in next.config.ts: empty or /Ballistics/next
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

/** An app path as the site serves it: below the base path, with a trailing slash before any query or fragment (`trailingSlash` of next.config.ts). */
const served = (path: string) => base + path.replace(/\/?(?=[?#]|$)/, '/')

/** A left click without a modifier on a link that opens in this tab, which Next's link handles itself. */
const inApp = (
  event: MouseEvent<HTMLAnchorElement>,
  anchor: AnchorHTMLAttributes<HTMLAnchorElement>,
) =>
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
  (!anchor.target || anchor.target === '_self') &&
  anchor.download === undefined

/** `next/link` in the Start build: Next's anchor, with no `aria-current` of the router's own link, navigating in the app on a plain click. */
export default function Link({
  href,
  replace = false,
  prefetch: _prefetch,
  onNavigate,
  onClick,
  children,
  ...anchor
}: LinkProps) {
  const router = useRouter()
  if (!href.startsWith('/') || href.startsWith('//'))
    return (
      <a {...anchor} href={href} onClick={onClick}>
        {children}
      </a>
    )
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || !inApp(event, anchor)) return
    event.preventDefault()
    let stay = false
    onNavigate?.({
      preventDefault: () => {
        stay = true
      },
    })
    if (!stay) void router.navigate({ href, replace })
  }
  return (
    <a {...anchor} href={served(href)} onClick={follow}>
      {children}
    </a>
  )
}
