// Stands in for `next/link`: the router's Link for app paths, a plain anchor for external URLs.
import { Link as RouterLink } from '@tanstack/react-router'
import { type AnchorHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { hrefString, routerTarget } from './href.ts'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: Parameters<typeof hrefString>[0]
  children?: ReactNode
  prefetch?: boolean | null | 'auto'
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
  legacyBehavior?: boolean
  locale?: string | false
  onNavigate?: unknown
}

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  {
    href,
    prefetch: _prefetch,
    replace,
    scroll,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacy,
    locale: _locale,
    onNavigate: _onNavigate,
    ...rest
  },
  ref,
) {
  const target = routerTarget(hrefString(href))
  if (target.external) {
    const { children, ...props } = rest
    return (
      <a ref={ref} href={hrefString(href)} {...props}>
        {children}
      </a>
    )
  }
  return (
    <RouterLink
      ref={ref}
      to={target.to as never}
      search={target.search as never}
      {...(target.hash && { hash: target.hash })}
      {...(replace && { replace })}
      {...(scroll === false && { resetScroll: false })}
      {...(rest as object)}
    />
  )
})

export default Link
