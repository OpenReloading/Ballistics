'use client'

import { Alert, Button, EmptyState, Group, Skeleton, Stack, Text } from '@mantine/core'
import { FunnelX, Info, Warning, WarningOctagon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useLayoutEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message as Marked, msg, type Translator } from '../i18n/translate.ts'
import { controlSize } from '../lib/theme.ts'
import { LibraryTabs } from './library-tabs.tsx'
import { PageBar } from './page-bar.tsx'

/** The one empty state of the app: nothing to show yet, and the action that adds it. */
export function EmptyNote({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode | undefined
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      size="sm"
      align="left"
      my="xs"
      styles={{ description: { maxWidth: '60ch' } }}
    >
      {action && <EmptyState.Actions>{action}</EmptyState.Actions>}
    </EmptyState>
  )
}

/**
 * What each page names while it loads, as a whole sentence (a noun phrase does not translate into
 * every language's word order). A `what` not listed here reads English text inside the sentence.
 */
const loadingTexts: Record<string, Marked> = {
  bullets: msg('Loading bullets'),
  disciplines: msg('Loading disciplines'),
  cartridges: msg('Loading cartridges'),
  'target faces': msg('Loading target faces'),
  federations: msg('Loading federations'),
  powders: msg('Loading powders'),
  'the preview': msg('Loading the preview'),
  'your data': msg('Loading your data'),
  'the designer': msg('Loading the designer'),
  cartridge: msg('Loading cartridge'),
  manufacturers: msg('Loading manufacturers'),
  firearms: msg('Loading firearms'),
  'the cases': msg('Loading the cases'),
  cases: msg('Loading cases'),
  primers: msg('Loading primers'),
  'the measurements': msg('Loading the measurements'),
  'the shot groups': msg('Loading the shot groups'),
  'the unit settings': msg('Loading the unit settings'),
  'the cartridge record': msg('Loading the cartridge record'),
  'the bullet record': msg('Loading the bullet record'),
  'the settings': msg('Loading the settings'),
  'the workbench defaults': msg('Loading the workbench defaults'),
  curves: msg('Loading curves'),
}

/** The loading sentence for `what`, without its closing ellipsis. */
function loadingText(t: Translator['t'], what: string) {
  const known = loadingTexts[what]
  return known ? t(known) : t('Loading {what}', { what })
}

/** `DataError` titles by the record kind callers name. */
const unavailableTexts: Record<string, Marked> = {
  Bullet: msg('Bullet data is unavailable right now.'),
  Discipline: msg('Discipline data is unavailable right now.'),
  Case: msg('Case data is unavailable right now.'),
  Cartridge: msg('Cartridge data is unavailable right now.'),
  'Target face': msg('Target face data is unavailable right now.'),
  Federation: msg('Federation data is unavailable right now.'),
  Primer: msg('Primer data is unavailable right now.'),
  Powder: msg('Powder data is unavailable right now.'),
}

/** `EmptyList` titles by the plural noun callers name. */
const noMatchTexts: Record<string, Marked> = {
  bullets: msg('No bullets match these filters.'),
  cases: msg('No cases match these filters.'),
  cartridges: msg('No cartridges match these filters.'),
  disciplines: msg('No disciplines match these filters.'),
  primers: msg('No primers match these filters.'),
  firearms: msg('No firearms match these filters.'),
  'target faces': msg('No target faces match these filters.'),
  powders: msg('No powders match these filters.'),
  federations: msg('No federations match these filters.'),
}

/**
 * The one loading state: the text for screen readers and a skeleton of the rows to come. `inline`
 * is a bare line without skeleton and status role, for a place that must not change height.
 */
export function Loading({
  what,
  rows = 3,
  inline = false,
}: {
  what: string
  rows?: number | undefined
  inline?: boolean
}) {
  const { t } = useTranslation()
  if (inline) return <p>{loadingText(t, what)}</p>
  return (
    <div role="status">
      <Text size="sm" c="dimmed">
        {loadingText(t, what)}…
      </Text>
      <Stack gap={6} mt={6} aria-hidden="true">
        {Array.from({ length: rows }, (_, k) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders without identity
          <Skeleton key={k} height={28} />
        ))}
      </Stack>
    </div>
  )
}

/** How serious a message is: a note, something to check, or something that failed. */
export type Severity = 'info' | 'warning' | 'error'

/** One entry of a `MessageSlot`. */
export interface MessageEntry {
  severity: Severity
  text: ReactNode
}

const severities = {
  info: { word: msg('Note'), color: 'blue', Icon: Info },
  warning: { word: msg('Warning'), color: 'orange', Icon: Warning },
  error: { word: msg('Error'), color: 'red', Icon: WarningOctagon },
} as const

/**
 * The one message: icon, the severity's word and the text, so colour is never the only signal. An
 * error is announced at once (`role="alert"`), a note or warning politely (`role="status"`).
 */
export function Message({
  severity,
  title,
  children,
  onRetry,
  compact = false,
  announce = true,
}: {
  severity: Severity
  title?: string | undefined
  children?: ReactNode
  /** Retry button under the text. */
  onRetry?: (() => void) | undefined
  /** No margin: for a slot that sets the room. */
  compact?: boolean | undefined
  /** False where a live region around it announces it: a plain note, no live role of its own. */
  announce?: boolean | undefined
}) {
  const { t } = useTranslation()
  const { word, color, Icon } = severities[severity]
  const label = <span className="message-label">{t(word)}:</span>
  return (
    <Alert
      className="message"
      data-severity={severity}
      color={color}
      variant="light"
      role={announce ? (severity === 'error' ? 'alert' : 'status') : 'note'}
      title={
        title && (
          <>
            {label} {title}
          </>
        )
      }
      icon={<Icon size={20} aria-hidden="true" />}
      {...(compact ? {} : { my: 'xs' })}
    >
      {!title && label}
      {!title && children && ' '}
      {children}
      {onRetry && (
        <Button
          display="block"
          size={controlSize.row.button}
          variant="default"
          mt={children ? 'xs' : 0}
          onClick={onRetry}
        >
          {t('Retry')}
        </Button>
      )}
    </Alert>
  )
}

/**
 * Whether a scroll area has more than its box shows, so it takes focus only then (a keyboard user
 * reaches the rest of its list) and is no empty tab stop otherwise. `ref` goes on the area; as a
 * callback it also follows an area that mounts later, as a popover's.
 */
export function useScrolls() {
  const [el, ref] = useState<HTMLElement | null>(null)
  const [scrolls, setScrolls] = useState(false)
  useLayoutEffect(() => {
    if (!el) return
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight)
    measure()
    // its box (a narrower window wraps the text) and its content
    const resize = new ResizeObserver(measure)
    const mutation = new MutationObserver(measure)
    resize.observe(el)
    mutation.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [el])
  return { ref, scrolls }
}

/**
 * A place for messages that keeps one size whether it holds none, one or many: a box of fixed
 * height whose list scrolls and takes focus once it has more than its box shows. `label` names the
 * region. It stays mounted as a polite live region, so a message that appears is announced and
 * nothing below moves.
 */
export function MessageSlot({
  label,
  messages,
}: {
  label: string
  messages: readonly MessageEntry[]
}) {
  const { ref, scrolls } = useScrolls()
  return (
    <fieldset
      ref={ref}
      className="message-slot"
      aria-label={label}
      // the polite region of every message that appears, an error included
      aria-live="polite"
      tabIndex={scrolls ? 0 : undefined}
      data-count={messages.length}
    >
      {messages.map((m, k) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: messages have no identity
        <Message key={k} severity={m.severity} compact announce={false}>
          {m.text}
        </Message>
      ))}
    </fieldset>
  )
}

/**
 * The one inline alert: what failed, and Retry with `onRetry`. `color` orange marks a warning
 * that is no failure.
 */
export function ErrorNote({
  title,
  children,
  onRetry,
  color = 'red',
}: {
  title?: string
  children?: ReactNode
  onRetry?: () => void
  color?: 'red' | 'orange'
}) {
  return (
    <Message severity={color === 'red' ? 'error' : 'warning'} title={title} onRetry={onRetry}>
      {children}
    </Message>
  )
}

/** The data of a page could not be read from the API; Retry asks again. */
export function DataError({ what, retry }: { what: string; retry: () => void }) {
  const { t } = useTranslation()
  const known = unavailableTexts[what]
  return (
    <ErrorNote
      title={known ? t(known) : t('{what} data is unavailable right now.', { what })}
      onRetry={retry}
    >
      {t('The server did not answer.')}
    </ErrorNote>
  )
}

/** A list page's error state: its page bar over `DataError`. */
export function ListError({
  title,
  what,
  retry,
}: {
  title: string
  what: string
  retry: () => void
}) {
  return (
    <>
      <PageBar title={title} />
      <LibraryTabs />
      <DataError what={what} retry={retry} />
    </>
  )
}

/** `DataError` in a server page: Retry renders the page's server data again. */
export function ServerDataError({ what }: { what: string }) {
  const router = useRouter()
  return (
    <>
      <LibraryTabs />
      <DataError what={what} retry={() => router.refresh()} />
    </>
  )
}

/** Row widths of the list skeleton, in percent of the name column: uneven, so it reads as text. */
const skeletonWidths = [62, 48, 70, 55, 66, 42, 58, 74, 50, 64, 46, 68]

/**
 * What a list shows while its data loads, under the page bar: a filter row and the table's
 * frame, its head and rows where the records will be, so nothing moves when they arrive.
 */
export function ListLoading({ what }: { what: string }) {
  const { t } = useTranslation()
  return (
    <>
      <LibraryTabs />
      <div className="directory" role="status">
        <span className="visually-hidden">{loadingText(t, what)}…</span>
        {/* the metrics of the real filter row (DirectoryFilters), so the frame stays where it is */}
        <Group className="directory-filters" gap="xs" py="xs" aria-hidden="true">
          <Skeleton height={30} className="directory-search" />
          <Skeleton height={30} width="7.5rem" />
        </Group>
        <div className="directory-scroll page-panel page-panel-flush" aria-hidden="true">
          <div className="list-skeleton-head" />
          {Array.from({ length: 32 }, (_, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders without identity
            <div key={k} className="list-skeleton-row">
              <Skeleton height={12} width={`${skeletonWidths[k % skeletonWidths.length]}%`} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * What a searched list shows when nothing matches. `filters` names the search and the choices set;
 * Clear filters with `onClear` resets them.
 */
export function EmptyList({
  noun,
  filters,
  onClear,
}: {
  noun: string
  filters?: string
  onClear?: () => void
}) {
  const { t } = useTranslation()
  const known = noMatchTexts[noun]
  return (
    <EmptyNote
      icon={<FunnelX size={24} aria-hidden="true" />}
      title={known ? t(known) : t('No {noun} match these filters.', { noun })}
      description={filters}
      action={
        onClear && (
          <Button variant="default" size={controlSize.row.button} onClick={onClear}>
            {t('Clear filters')}
          </Button>
        )
      }
    />
  )
}
