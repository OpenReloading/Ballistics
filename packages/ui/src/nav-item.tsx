import type { LucideIcon } from 'lucide-react'
import type { ComponentPropsWithRef, ReactElement } from 'react'

export interface NavItemProps extends ComponentPropsWithRef<'a'> {
  /** A Lucide icon, or an own one on Lucide's grid. */
  icon: LucideIcon
  label: string
}

/** A link of the main navigation, an icon over its label; a router wraps it (TanStack Router's `createLink`). */
export function NavItem({ icon: Icon, label, className, ...anchor }: NavItemProps): ReactElement {
  return (
    <a {...anchor} className={className ? `ui-nav-item ${className}` : 'ui-nav-item'}>
      <Icon aria-hidden size={20} strokeWidth={1.75} />
      <span>{label}</span>
    </a>
  )
}
