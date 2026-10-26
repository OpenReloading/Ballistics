'use client'

import { ActionIcon } from '@mantine/core'
import { useMounted } from '@mantine/hooks'
import { DotsThree } from '@phosphor-icons/react'
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { SafetyBarButton } from './safety-dialog.tsx'

/**
 * The status line of the page bar, for Open and Save among its actions (`FileMenu` portals its
 * state there): undefined outside a bar, null until the line is mounted.
 */
export const BarStatus = createContext<HTMLElement | null | undefined>(undefined)

/**
 * A list's count as the bar's live region, a status only once mounted: a streamed copy of the page
 * that React has not swapped in yet (a hidden `S:` segment) holds no second status. `widest`, the
 * longest text it can show, sets its width from 48em, so what follows it never moves.
 */
export function BarCount({
  children,
  widest,
}: {
  children: ReactNode
  widest?: string | undefined
}) {
  return (
    <span
      role={useMounted() ? 'status' : undefined}
      className="bar-count"
      style={widest ? ({ '--count-w': `${widest.length}ch` } as CSSProperties) : undefined}
    >
      {children}
    </span>
  )
}

/**
 * The page's top bar: its only
 * `h1`, what follows the title (the open load, a record's badges), one status line and the page's
 * actions in the order primary action, Open, Save, Export, Units, Copy link, Print. Below 75em it
 * sits in the top bar and "Page actions" shows the same actions in a panel, each a row with its
 * text: one instance at every width, so no menu or form is mounted twice.
 */
export function PageBar({
  title,
  after,
  status,
  actions,
  single = false,
  reserve = false,
  titleHidden = false,
  compact = false,
}: {
  title: string
  /** The h1 for screen readers only: the home page shows the wordmark instead. */
  titleHidden?: boolean
  /** Beside the title: the workbench's open loads, a record's standard badges. */
  after?: ReactNode
  /** The status line's own content, such as a list's count. */
  status?: ReactNode
  actions?: ReactNode
  /** One action only: below 75em it shows as itself in the bar, not behind "Page actions". */
  single?: boolean
  /**
   * A loading bar that holds the box of the bar that replaces it, so nothing moves when it is replaced:
   * the status row and the Page actions slot, empty and not shown.
   */
  reserve?: boolean | undefined
  /** The Safety button as an icon, as the workbench's other secondary actions. */
  compact?: boolean
}) {
  const [statusLine, setStatusLine] = useState<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const mounted = useMounted()
  // the phone panel closes on a press outside the bar and the menus and dialogs it opened
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null
      if (!t || root.current?.contains(t) || t.closest('[role="menu"], [role="dialog"]')) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return (
    <div
      ref={root}
      className="page-bar"
      data-open={open || undefined}
      data-single={(actions && single) || undefined}
    >
      <div className="page-bar-title">
        {/* `data-hydrated`: the e2e ready signal of the page, which hydrates after the layout */}
        <h1
          title={title}
          className={titleHidden ? 'visually-hidden' : undefined}
          data-hydrated={mounted || undefined}
        >
          {title}
        </h1>
        {after}
      </div>
      <div className="page-bar-status" ref={setStatusLine}>
        {/* the File menu's state text sets the line height of a final status: the same class here */}
        {status ?? (reserve ? <span className="file-state">{'\u00a0'}</span> : undefined)}
      </div>
      {actions && single && (
        <div className="page-bar-actions">
          <BarStatus value={statusLine}>{actions}</BarStatus>
        </div>
      )}
      {actions && !single && (
        <>
          <ActionIcon
            ref={toggle}
            className="page-bar-toggle"
            variant="default"
            aria-label="Page actions"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
          >
            <DotsThree size={20} aria-hidden="true" />
          </ActionIcon>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: an action chosen or Escape closes the phone panel */}
          <div
            id={id}
            role="presentation"
            className="page-bar-actions"
            // a chosen action closes it, also a menu item in its portal (React events bubble through
            // portals); not a button that opens a menu or a dialog, which returns to it
            onClick={(e) => {
              const t =
                e.target instanceof Element ? e.target.closest('button, [role="menuitem"]') : null
              if (open && t && !t.hasAttribute('aria-haspopup')) setOpen(false)
            }}
            onKeyDown={(e) => {
              // not from a menu's portalled dropdown: that one closes itself
              if (e.key !== 'Escape' || !open || !e.currentTarget.contains(e.target as Node)) return
              setOpen(false)
              toggle.current?.focus()
            }}
          >
            <BarStatus value={statusLine}>{actions}</BarStatus>
          </div>
        </>
      )}
      {reserve && (
        <ActionIcon
          className="page-bar-toggle"
          variant="default"
          style={{ visibility: 'hidden' }}
        />
      )}
      {/* on every page from 75em; below it the top bar's icon button (site-header.tsx) */}
      <SafetyBarButton iconOnly={compact} className="page-bar-safety" />
    </div>
  )
}
