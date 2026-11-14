import type { ReactElement, ReactNode } from 'react'

export interface PageBarProps {
  /** The page's only h1. */
  title: string
  /** A short state of the page, such as a count; announced when it changes. */
  status?: ReactNode
  /** The page's actions, the primary one first. */
  actions?: ReactNode
}

/** The top of every page: its title, its status and its actions, which wrap below the title on a phone. */
export function PageBar({ title, status, actions }: PageBarProps): ReactElement {
  return (
    <div className="ui-page-bar">
      <h1>{title}</h1>
      {/* the live region stays in the page, so the first change is announced */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an explicit live region, not one implied by <output>'s role */}
      <span role="status" className="ui-page-bar-status">
        {status}
      </span>
      {actions && <div className="ui-page-bar-actions">{actions}</div>}
    </div>
  )
}
