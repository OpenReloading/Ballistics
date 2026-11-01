'use client'

import { ActionIcon, Tooltip } from '@mantine/core'
import { useMediaQuery, useMounted } from '@mantine/hooks'
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
import { useTranslation } from '../i18n/language.ts'
import type { Message } from '../i18n/translate.ts'
import { tipEvents } from '../lib/theme.ts'
import { useBarEndSlot } from './bar-end.ts'
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

/** The text of `box`'s innermost elements joined by spaces, kept current; the File menu portals into it. */
function useWholeText(box: HTMLElement | null) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!box) return
    const read = () =>
      setText(
        Array.from(box.querySelectorAll('*'))
          .filter((e) => e.childElementCount === 0)
          // `data-full`: the whole text of a leaf shown shortened
          .map((e) => e.getAttribute('data-full') ?? e.textContent?.trim())
          .filter(Boolean)
          .join(' '),
      )
    read()
    const watch = new MutationObserver(read)
    watch.observe(box, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-full'],
    })
    return () => watch.disconnect()
  }, [box])
  return text
}

/** The panel's actions: the folded ones first, in their own box `foldId` (globals.css). */
const withFold = (fold: ReactNode, actions: ReactNode, foldId: string) => (
  <>
    {fold && (
      <div id={foldId} className="page-bar-fold">
        {fold}
      </div>
    )}
    {actions}
  </>
)

/** The bar's h1; `short` in its place below 48em, `hydrated` the page's e2e ready signal. */
function PageTitle({
  title,
  short,
  hidden,
  hydrated,
}: {
  title: string
  short: string | undefined
  hidden: boolean
  hydrated: boolean
}) {
  return (
    <h1
      title={title}
      className={hidden ? 'visually-hidden' : undefined}
      data-hydrated={hydrated || undefined}
    >
      {short && short !== title ? (
        <>
          <span className="page-title-long">{title}</span>
          <span className="page-title-short">{short}</span>
        </>
      ) : (
        title
      )}
    </h1>
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
  title: given,
  translated,
  short,
  after,
  status,
  actions,
  fold,
  single = false,
  reserve = false,
  titleHidden = false,
  compact = false,
}: {
  /** The h1 for screen readers only: the home page shows the wordmark instead. */
  titleHidden?: boolean
  /**
   * The h1 below 48em, where the bar has room for little more than a name: a powder's name
   * without its manufacturer, which the first card of the strip names.
   */
  short?: string | undefined
  /** Beside the title: the workbench's open loads, a record's standard badges. */
  after?: ReactNode
  /** The status line's own content, such as a list's count. */
  status?: ReactNode
  actions?: ReactNode
  /**
   * Actions before `actions` that fold behind "Page actions" from 48em to 75em, where `actions`
   * (Open, Save, Units) stay in the bar: a designer's Undo, Redo and New. From 75em and on a phone
   * they are actions like the others. One instance at every width.
   */
  fold?: ReactNode
  /** One action only: below 75em it shows as itself in the bar, not behind "Page actions". */
  single?: boolean
  /**
   * A loading bar that holds the box of the bar that replaces it, so nothing moves when it is replaced:
   * the status row and the Page actions slot, empty and not shown.
   */
  reserve?: boolean | undefined
  /** The Safety button as an icon, as the workbench's other secondary actions. */
  compact?: boolean
} & (
  | {
      /** The h1: a record's name, as published. */
      title: string
      translated?: false
    }
  | {
      /** The h1: a message of the catalogue (a list's title), which the language shown translates. */
      title: Message
      translated: true
    }
)) {
  const { t } = useTranslation()
  const title = translated ? t(given) : given
  const [statusLine, setStatusLine] = useState<HTMLDivElement | null>(null)
  const full = useWholeText(statusLine)
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const foldId = `${id}-fold`
  // from 48em to 75em only the folded actions are behind the toggle (globals.css `data-fold`)
  const foldShown = useMediaQuery('screen and (min-width: 48em) and (max-width: 74.99em)', false, {
    getInitialValueInEffect: true,
  })
  const folds = Boolean(fold) && foldShown
  const mounted = useMounted()
  const endSlot = useBarEndSlot()
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
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the phone panel, also from its toggle
    <div
      ref={root}
      className="page-bar"
      data-open={open || undefined}
      data-single={(actions && single) || undefined}
      data-fold={(actions && fold && !single) || undefined}
      onKeyDown={(e) => {
        // not from a menu's portalled dropdown: that one closes itself
        if (e.key !== 'Escape' || !open || !e.currentTarget.contains(e.target as Node)) return
        setOpen(false)
        toggle.current?.focus()
      }}
    >
      <div className="page-bar-title">
        {/* `data-hydrated`: the e2e ready signal of the page, which hydrates after the layout */}
        <PageTitle title={title} short={short} hidden={titleHidden} hydrated={mounted} />
        {after}
      </div>
      {/* the line ends in an ellipsis where it is too long: its whole text on hover, focus and tap */}
      <Tooltip label={full} events={tipEvents} multiline maw={320} disabled={!full}>
        <div
          className="page-bar-status"
          ref={setStatusLine}
          tabIndex={full ? 0 : undefined}
          role="note"
          aria-label={full || undefined}
        >
          {/* the File menu's state text sets the line height of a final status: the same class here */}
          {status ?? (reserve ? <span className="file-state">{'\u00a0'}</span> : undefined)}
        </div>
      </Tooltip>
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
            aria-label={t('Page actions')}
            aria-expanded={open}
            // what it shows and hides: the folded box where the other actions stay in the bar
            aria-controls={folds ? foldId : id}
            onClick={() => setOpen((o) => !o)}
          >
            <DotsThree size={20} aria-hidden="true" />
          </ActionIcon>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: an action chosen closes the phone panel */}
          <div
            id={id}
            role="presentation"
            className="page-bar-actions"
            // a chosen action closes it, also a menu item in its portal (React events bubble through
            // portals); not a button that opens a menu or a dialog, which returns to it
            onClick={(e) => {
              const t =
                e.target instanceof Element ? e.target.closest('button, [role="menuitem"]') : null
              // an aria-disabled action does nothing: the panel stays, its tooltip says why
              if (
                open &&
                t &&
                !t.hasAttribute('aria-haspopup') &&
                t.getAttribute('aria-disabled') !== 'true'
              )
                setOpen(false)
            }}
          >
            <BarStatus value={statusLine}>{withFold(fold, actions, foldId)}</BarStatus>
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
      {/* from 75em the top bar's Report, repository and theme buttons, after the actions as shown */}
      <div ref={endSlot} className="page-bar-end" />
    </div>
  )
}
