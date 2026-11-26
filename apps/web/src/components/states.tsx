'use client'

import { useLingui } from '@lingui/react'
import { Alert, Button, EmptyState, Group, Skeleton, Stack, Text } from '@mantine/core'
import { FunnelX, Info, OctagonExclamationPoint, TriangleExclamationPoint } from 'lucide-react'
import { type ReactNode, useLayoutEffect, useState } from 'react'
import { useRouter } from '@/platform/navigation.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import type { Message as Marked } from '../i18n/translate.ts'
import { controlSize } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/states.json' with { type: 'json' }
import { LibraryTabs } from './library-tabs.tsx'
import { PageBar } from './page-bar.tsx'

loadEnglish(englishMessages)

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

/** A whole sentence each, as the word order of a language is its own; a new `what` gets its line here. */
const loadingLines = {
  bullets: /*i18n*/ { id: 'states.loading.bullets', message: 'Loading bullets' },
  cartridges: /*i18n*/ { id: 'states.loading.cartridges', message: 'Loading cartridges' },
  powders: /*i18n*/ { id: 'states.loading.powders', message: 'Loading powders' },
  cases: /*i18n*/ { id: 'states.loading.cases', message: 'Loading brass' },
  primers: /*i18n*/ { id: 'states.loading.primers', message: 'Loading primers' },
  disciplines: /*i18n*/ { id: 'states.loading.disciplines', message: 'Loading disciplines' },
  federations: /*i18n*/ { id: 'states.loading.federations', message: 'Loading federations' },
  firearms: /*i18n*/ { id: 'states.loading.firearms', message: 'Loading firearms' },
  'target faces': /*i18n*/ { id: 'states.loading.targetFaces', message: 'Loading targets' },
  bullet: /*i18n*/ { id: 'states.loading.bullet', message: 'Loading bullet' },
  cartridge: /*i18n*/ { id: 'states.loading.cartridge', message: 'Loading cartridge' },
  case: /*i18n*/ { id: 'states.loading.case', message: 'Loading the brass record' },
  discipline: /*i18n*/ { id: 'states.loading.discipline', message: 'Loading discipline' },
  federation: /*i18n*/ { id: 'states.loading.federation', message: 'Loading federation' },
  powder: /*i18n*/ { id: 'states.loading.powder', message: 'Loading powder' },
  primer: /*i18n*/ { id: 'states.loading.primer', message: 'Loading primer' },
  'target face': /*i18n*/ { id: 'states.loading.targetFace', message: 'Loading target' },
  curves: /*i18n*/ { id: 'states.loading.curves', message: 'Loading curves' },
  manufacturers: /*i18n*/ { id: 'states.loading.manufacturers', message: 'Loading manufacturers' },
  'the bullet record': /*i18n*/ {
    id: 'states.loading.theBulletRecord',
    message: 'Loading the bullet record',
  },
  'the cartridge record': /*i18n*/ {
    id: 'states.loading.theCartridgeRecord',
    message: 'Loading the cartridge record',
  },
  'the cases': /*i18n*/ { id: 'states.loading.theCases', message: 'Loading the brass' },
  'the designer': /*i18n*/ { id: 'states.loading.theDesigner', message: 'Loading the designer' },
  'the measurements': /*i18n*/ {
    id: 'states.loading.theMeasurements',
    message: 'Loading the measurements',
  },
  'the powder comparison': /*i18n*/ {
    id: 'states.loading.thePowderComparison',
    message: 'Loading the powder comparison',
  },
  'the preview': /*i18n*/ { id: 'states.loading.thePreview', message: 'Loading the preview' },
  'the settings': /*i18n*/ { id: 'states.loading.theSettings', message: 'Loading the settings' },
  'the shot groups': /*i18n*/ {
    id: 'states.loading.theShotGroups',
    message: 'Loading the shot groups',
  },
  'the trajectory': /*i18n*/ {
    id: 'states.loading.theTrajectory',
    message: 'Loading the trajectory',
  },
  'the truing': /*i18n*/ { id: 'states.loading.theTruing', message: 'Loading the truing' },
  'the unit settings': /*i18n*/ {
    id: 'states.loading.theUnitSettings',
    message: 'Loading the unit settings',
  },
  'the workbench defaults': /*i18n*/ {
    id: 'states.loading.theWorkbenchDefaults',
    message: 'Loading the workbench defaults',
  },
  'your data': /*i18n*/ { id: 'states.loading.yourData', message: 'Loading your data' },
} as const

/** What can load: a key of `loadingLines`. */
export type Loadable = keyof typeof loadingLines

/** `inline` is a bare line without skeleton and status role, for a place that must not change height. */
export function Loading({
  what,
  rows = 3,
  inline = false,
}: {
  what: Loadable
  rows?: number | undefined
  inline?: boolean
}) {
  const { i18n } = useLingui()
  const line = i18n._(loadingLines[what])
  if (inline) return <p>{line}</p>
  return (
    <div role="status">
      <Text size="sm" c="dimmed">
        {line}…
      </Text>
      <Stack gap="xs" mt="xs" aria-hidden="true">
        {Array.from({ length: rows }, (_, k) => (
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
  info: { word: /*i18n*/ { id: 'states.note', message: 'Note' }, color: 'blue', Icon: Info },
  warning: {
    word: /*i18n*/ { id: 'states.warning', message: 'Warning' },
    color: 'orange',
    Icon: TriangleExclamationPoint,
  },
  error: {
    word: /*i18n*/ { id: 'states.error', message: 'Error' },
    color: 'red',
    Icon: OctagonExclamationPoint,
  },
} as const

/** Icon, the severity's word and the text, so color is never the only signal; an error is announced at once (`role="alert"`), a note or warning politely (`role="status"`). */
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
  const { i18n } = useLingui()
  const { word, color, Icon } = severities[severity]
  const label = <span className="message-label">{i18n._(word)}:</span>
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
          {i18n._({ id: 'states.retry', message: 'Retry' })}
        </Button>
      )}
    </Alert>
  )
}

/** Focusable only then, so a keyboard user reaches the rest of its list and finds no empty tab stop; `ref` as a callback also follows an area that mounts later, as a popover's. */
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

/** A box of fixed height whose list scrolls and takes focus once it has more than its box shows; it stays mounted as a polite live region, so a new message is announced and nothing below moves. */
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
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a region that scrolls takes focus, so the keyboard can scroll it
      tabIndex={scrolls ? 0 : undefined}
      data-count={messages.length}
    >
      {messages.map((m, k) => (
        // oxlint-disable-next-line react/no-array-index-key -- messages have no identity
        <Message key={k} severity={m.severity} compact announce={false}>
          {m.text}
        </Message>
      ))}
    </fieldset>
  )
}

/** `color` orange marks a warning that is no failure. */
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

/** The title of the error state of a kind's data: a whole sentence each. */
const unavailableLines = {
  Bullet: /*i18n*/ {
    id: 'states.unavailable.bullet',
    message: 'Bullet data is unavailable right now.',
  },
  Cartridge: /*i18n*/ {
    id: 'states.unavailable.cartridge',
    message: 'Cartridge data is unavailable right now.',
  },
  Case: /*i18n*/ { id: 'states.unavailable.case', message: 'Brass data is unavailable right now.' },
  Discipline: /*i18n*/ {
    id: 'states.unavailable.discipline',
    message: 'Discipline data is unavailable right now.',
  },
  'Event type': /*i18n*/ {
    id: 'states.unavailable.eventType',
    message: 'Event type data is unavailable right now.',
  },
  Federation: /*i18n*/ {
    id: 'states.unavailable.federation',
    message: 'Federation data is unavailable right now.',
  },
  Powder: /*i18n*/ {
    id: 'states.unavailable.powder',
    message: 'Powder data is unavailable right now.',
  },
  Primer: /*i18n*/ {
    id: 'states.unavailable.primer',
    message: 'Primer data is unavailable right now.',
  },
  'Target face': /*i18n*/ {
    id: 'states.unavailable.targetFace',
    message: 'Target data is unavailable right now.',
  },
} as const

/** The kinds whose data a page can fail to read: a key of `unavailableLines`. */
export type DataKind = keyof typeof unavailableLines

/** The data of a page could not be read from the API; Retry asks again. */
export function DataError({ what, retry }: { what: DataKind; retry: () => void }) {
  const { i18n } = useLingui()
  return (
    <ErrorNote title={i18n._(unavailableLines[what])} onRetry={retry}>
      {i18n._({
        id: 'states.dataError',
        message: 'The data file could not be loaded. Check the connection and retry.',
      })}
    </ErrorNote>
  )
}

/** A list page's error state: its page bar over `DataError`. */
export function ListError({
  title,
  what,
  retry,
}: {
  title: Marked
  what: DataKind
  retry: () => void
}) {
  return (
    <>
      <PageBar title={title} translated />
      <LibraryTabs />
      <DataError what={what} retry={retry} />
    </>
  )
}

/** `DataError` in a server page: Retry renders the page's server data again. */
export function ServerDataError({ what }: { what: DataKind }) {
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

/** The filter row and the table's frame where the records will be, so nothing moves when they arrive. */
export function ListLoading({ what }: { what: Loadable }) {
  const { i18n } = useLingui()
  return (
    <>
      <LibraryTabs />
      <div className="directory" role="status">
        <span className="visually-hidden">{i18n._(loadingLines[what])}…</span>
        {/* the metrics of the real filter row (DirectoryFilters), so the frame stays where it is */}
        <Group className="directory-filters" gap="xs" py="xs" aria-hidden="true">
          <Skeleton height={30} className="directory-search" />
          <Skeleton height={30} width="7.5rem" />
        </Group>
        <div className="directory-scroll page-panel page-panel-flush" aria-hidden="true">
          <div className="list-skeleton-head" />
          {Array.from({ length: 32 }, (_, k) => (
            <div key={k} className="list-skeleton-row">
              <Skeleton height={12} width={`${skeletonWidths[k % skeletonWidths.length]}%`} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/** What a searched list says when nothing matches, by what it lists: a whole sentence each. */
const noMatchLines = {
  bullets: /*i18n*/ { id: 'states.noMatch.bullets', message: 'No bullets match these filters.' },
  cartridges: /*i18n*/ {
    id: 'states.noMatch.cartridges',
    message: 'No cartridges match these filters.',
  },
  cases: /*i18n*/ { id: 'states.noMatch.cases', message: 'No brass matches these filters.' },
  disciplines: /*i18n*/ {
    id: 'states.noMatch.disciplines',
    message: 'No disciplines match these filters.',
  },
  federations: /*i18n*/ {
    id: 'states.noMatch.federations',
    message: 'No federations match these filters.',
  },
  firearms: /*i18n*/ { id: 'states.noMatch.firearms', message: 'No firearms match these filters.' },
  'log entries': /*i18n*/ {
    id: 'states.noMatch.logEntries',
    message: 'No entries match these filters.',
  },
  powders: /*i18n*/ { id: 'states.noMatch.powders', message: 'No powders match these filters.' },
  primers: /*i18n*/ { id: 'states.noMatch.primers', message: 'No primers match these filters.' },
  'target faces': /*i18n*/ {
    id: 'states.noMatch.targetFaces',
    message: 'No targets match these filters.',
  },
} as const

/** `filters` names the search and the choices set; Clear filters (`onClear`) resets them. */
export function EmptyList({
  noun,
  filters,
  onClear,
}: {
  noun: keyof typeof noMatchLines
  filters?: string
  onClear?: () => void
}) {
  const { i18n } = useLingui()
  return (
    <EmptyNote
      icon={<FunnelX size={24} aria-hidden="true" />}
      title={i18n._(noMatchLines[noun])}
      description={filters}
      action={
        onClear && (
          <Button variant="default" size={controlSize.row.button} onClick={onClear}>
            {i18n._({ id: 'states.clearFilters', message: 'Clear filters' })}
          </Button>
        )
      }
    />
  )
}
