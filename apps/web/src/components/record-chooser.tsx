'use client'

import {
  Badge,
  Button,
  type ComboboxData,
  Loader,
  SegmentedControl,
  Select,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Funnel, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { UnitSystem } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { EmptyNote, ErrorNote } from './states.tsx'

/** Rows drawn at once: a narrower search shows the rest. */
const shownRows = 100

/** A row of a chooser: a catalogue record, or a design of the browser (`origin: 'user'`). */
export interface ChooserRow {
  id: string
  name: string
  manufacturerName?: string | undefined
  origin?: 'user' | undefined
}

/** A filter drawn as a select: its options and the rows each option keeps. */
export interface ChooserSelect<R> {
  label: Message
  nothingFound: Message
  /** The options of the loaded catalogue (`catalogue`) or of every row (`rows`). */
  options: (catalogue: readonly R[], rows: readonly R[], t: Translator['t']) => ComboboxData
  keep: (row: R, value: string) => boolean
}

/** The options of the values `of` the rows give, each labelled by `label` with its number of rows. */
export function countedOptions<R>(
  rows: readonly R[],
  of: (row: R) => string | undefined,
  label: (value: string) => string,
) {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = of(r)
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, n]) => ({ value, name: label(value), n }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ value, name, n }) => ({ value, label: `${name} (${n})` }))
}

/** The manufacturer filter of a kind whose catalogue rows name their manufacturer. */
export function manufacturerSelect<
  R extends ChooserRow & { manufacturer?: string | undefined },
>(): ChooserSelect<R> {
  return {
    label: msg('Manufacturer'),
    nothingFound: msg('No manufacturer found'),
    options: (catalogue) => {
      const names = new Map(catalogue.map((r) => [r.manufacturer, r.manufacturerName]))
      return countedOptions(
        catalogue,
        (r) => r.manufacturer,
        (id) => names.get(id) || id,
      )
    },
    keep: (r, v) => r.manufacturer === v,
  }
}

/** A column after the name column: its head, width and the cell text of a row. */
interface ChooserColumn<R> {
  label: Message
  width: string
  cell: (row: R, system: UnitSystem, t: Translator['t']) => string
}

/** What a chooser's dialog says, each a message of one record kind. */
export interface ChooserTexts {
  title: Message
  close: Message
  search: Message
  help: Message
  /** The head of the name column. */
  column: Message
  list: Message
  preview: Message
  loading: Message
  /** `{total}` */
  all: Message
  /** `{found}` of `{total}` */
  some: Message
  /** `{found}` of `{total}`, `{shown}` shown */
  cut: Message
  errorTitle: Message
  errorText: Message
  empty: Message
}

/**
 * One record kind of the chooser dialog: its texts, catalogue, filters, sorts, ranking, columns
 * and the facts of its preview.
 */
export interface ChooserKind<R extends ChooserRow> {
  texts: ChooserTexts
  /** The whole catalogue, read once per page load; without it the page gives the rows (`catalogue`). */
  load?: () => Promise<R[]>
  selects: readonly ChooserSelect<R>[]
  /** The first is the default. */
  sorts: readonly { value: string; label: Message }[]
  /** The rows that match `query`, in the order of `sort`. */
  search: (rows: readonly R[], query: string, sort: string) => R[]
  columns: readonly ChooserColumn<R>[]
  facts: (row: R, system: UnitSystem, t: Translator['t']) => [Message, string | undefined][]
  /** The page of a catalogue record, if it has one. */
  href?: (row: R) => string | undefined
}

type Catalogue<R> =
  | { status: 'loading' }
  | { status: 'ok'; rows: readonly R[] }
  | { status: 'error' }

/** The catalogue is read when the dialog first opens, again after Retry. */
function useCatalogue<R>(opened: boolean, load: (() => Promise<R[]>) | undefined) {
  const [state, setState] = useState<Catalogue<R>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reads it again
  useEffect(() => {
    if (!opened || !load || state.status === 'ok') return
    let live = true
    setState({ status: 'loading' })
    load().then(
      (rows) => live && setState({ status: 'ok', rows }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
  }, [opened, attempt])
  return { state, retry: () => setAttempt((n) => n + 1) }
}

const keySteps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }

/** Enter chooses the highlighted row, the arrow and page keys move the highlight. */
export function searchKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  choose: () => void,
  move: (by: number) => void,
) {
  // the Enter that confirms an IME composition picks no row
  if (e.nativeEvent.isComposing) return
  // Ctrl+Enter (Cmd+Enter) stays free for the calculator's run shortcut
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    choose()
    return
  }
  const step = keySteps[e.key]
  if (step === undefined) return
  e.preventDefault()
  move(step)
}

function statusMessage<R>(
  state: Catalogue<R>,
  texts: ChooserTexts,
  found: number,
  total: number,
  t: Translator['t'],
) {
  if (state.status === 'loading') return t(texts.loading)
  if (state.status === 'error') return ''
  if (found === total) return t(texts.all, { total })
  return found > shownRows
    ? t(texts.cut, { found, total, shown: shownRows })
    : t(texts.some, { found, total })
}

interface RowsProps<R extends ChooserRow> {
  kind: ChooserKind<R>
  id: string
  active: number
  system: UnitSystem
  onActive: (i: number) => void
  onChoose: (row: R) => void
}

function ResultRow<R extends ChooserRow>({
  row,
  index,
  kind,
  id,
  active,
  system,
  onActive,
  onChoose,
}: RowsProps<R> & { row: R; index: number }) {
  const { t } = useTranslation()
  return (
    // keyboard: the search box owns the focus and moves the highlight
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <div
      id={`${id}-option-${index}`}
      role="option"
      tabIndex={-1}
      // the search box keeps the focus when a row is pressed
      onMouseDown={(e) => e.preventDefault()}
      aria-selected={index === active}
      className="bd-row"
      data-active={index === active || undefined}
      onMouseMove={() => index !== active && onActive(index)}
      onClick={() => onChoose(row)}
    >
      <span className="bd-name">
        {row.manufacturerName && <span className="bd-maker">{row.manufacturerName}</span>}
        <span>
          {row.name}
          {row.origin && (
            <Badge ml="xs" variant="light">
              {t('Your design')}
            </Badge>
          )}
        </span>
      </span>
      {kind.columns.map((c) => (
        <span key={c.label}>{c.cell(row, system, t)}</span>
      ))}
    </div>
  )
}

function Results<R extends ChooserRow>({
  status,
  retry,
  shown,
  ...props
}: RowsProps<R> & { status: Catalogue<R>['status']; retry: () => void; shown: R[] }) {
  const { t } = useTranslation()
  const { texts, columns } = props.kind
  if (status === 'error')
    return (
      <ErrorNote title={t(texts.errorTitle)} onRetry={retry}>
        {t(texts.errorText)}
      </ErrorNote>
    )
  if (shown.length === 0)
    return status === 'ok' ? (
      <EmptyNote
        icon={<MagnifyingGlass size={20} aria-hidden="true" />}
        title={t(texts.empty)}
        description={t('Remove a filter or a word.')}
      />
    ) : null
  return (
    <div className="bd-list-wrap">
      <div className="bd-head" aria-hidden="true">
        <span>{t(texts.column)}</span>
        {columns.map((c) => (
          <span key={c.label}>{t(c.label)}</span>
        ))}
      </div>
      <div id={`${props.id}-list`} role="listbox" aria-label={t(texts.list)} className="bd-list">
        {shown.map((row, i) => (
          <ResultRow key={row.id} row={row} index={i} {...props} />
        ))}
      </div>
    </div>
  )
}

/**
 * The record picker of a workbench card as a dialog, for one record `kind`: a search box over the
 * whole catalogue and the browser's own designs, filters, a result list and a preview of the
 * highlighted record. The search box keeps the focus: arrow keys highlight, Enter or a click
 * chooses. `filters` and `chips` hold a kind's own filters, which `kind.search` reads; `count` is
 * how many of them are set. `catalogue` gives the rows of a kind without `load`, such as the
 * user's firearms.
 */
export function RecordChooser<R extends ChooserRow>({
  kind,
  opened,
  onClose,
  text,
  designs,
  system,
  onChoose,
  filters,
  count = 0,
  chips,
  catalogue: given,
}: {
  kind: ChooserKind<R>
  opened: boolean
  onClose: () => void
  /** What the card's field held when the dialog was opened. */
  text: string
  /** The browser's designs as rows, listed first among equal matches. */
  designs: readonly R[]
  system: UnitSystem
  onChoose: (row: R) => void
  filters?: ReactNode
  count?: number
  chips?: ReactNode
  catalogue?: readonly R[]
}) {
  const { t } = useTranslation()
  const { texts } = kind
  const read = useCatalogue(opened, kind.load)
  const state = useMemo<Catalogue<R>>(
    () => (given ? { status: 'ok', rows: given } : read.state),
    [given, read.state],
  )
  const phone = useMediaQuery('(max-width: 47.99em)')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<readonly string[]>([])
  const [origin, setOrigin] = useState<'all' | 'catalogue' | 'designs'>('all')
  const [sort, setSort] = useState(kind.sorts[0]?.value ?? '')
  const [active, setActive] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const id = useId()
  const searchBox = useRef<HTMLInputElement>(null)

  // each opening starts from the card's text and no filter
  // biome-ignore lint/correctness/useExhaustiveDependencies: on opening only
  useEffect(() => {
    if (!opened) return
    setQuery(text)
    setPicked([])
    setOrigin('all')
    setSort(kind.sorts[0]?.value ?? '')
    setFiltersOpen(false)
  }, [opened])

  const catalogue = state.status === 'ok' ? state.rows : []
  const rows = useMemo<R[]>(() => [...designs, ...catalogue], [designs, catalogue])
  const typed = useDeferredValue(query)
  const results = useMemo(() => {
    const kept = rows.filter(
      (r) =>
        (origin === 'all' || (origin === 'designs') === (r.origin === 'user')) &&
        kind.selects.every((s, i) => !picked[i] || s.keep(r, picked[i])),
    )
    return kind.search(kept, typed, sort)
  }, [rows, typed, picked, origin, kind, sort])
  // after a failed read only the error shows, so no listbox or highlight is left behind
  const shown = state.status === 'error' ? [] : results.slice(0, shownRows)
  // another list highlights its first row; the same list, found again, keeps the highlight
  const listKey = `${results.length}:${results[0]?.id}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the list
  useEffect(() => setActive(0), [listKey])
  const current = shown[Math.min(active, shown.length - 1)]
  const optionId = (i: number) => `${id}-option-${i}`
  useEffect(() => {
    if (opened && current)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, opened, current, id])

  const options = useMemo(
    () => kind.selects.map((s) => s.options(catalogue, rows, t)),
    [kind, catalogue, rows, t],
  )
  const filterCount = picked.filter(Boolean).length + count + (origin === 'all' ? 0 : 1)
  const message = statusMessage(state, texts, results.length, rows.length, t)

  function move(by: number) {
    if (shown.length === 0) return
    setActive((i) => Math.max(0, Math.min(shown.length - 1, i + by)))
  }

  function choose(row: R | undefined) {
    if (row) onChoose(row)
  }

  const list = shown.length > 0
  const listAria = { 'aria-controls': `${id}-list`, 'aria-activedescendant': optionId(active) }
  const columns = `minmax(0, 1fr) ${kind.columns.map((c) => c.width).join(' ')}`
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={t(texts.title)}
      size="64rem"
      fullScreen={phone}
      className="bd-modal"
      closeButton={{ 'aria-label': t(texts.close) }}
    >
      <div className="bd" style={{ '--bd-columns': columns } as React.CSSProperties}>
        <TextInput
          ref={searchBox}
          data-autofocus
          label={t(texts.search)}
          description={t(texts.help)}
          autoComplete="off"
          value={query}
          rightSection={state.status === 'loading' ? <Loader size="xs" /> : undefined}
          onChange={(e) => setQuery(e.currentTarget.value)}
          role="combobox"
          aria-expanded={list}
          {...(list && listAria)}
          aria-autocomplete="list"
          onKeyDown={(e) => searchKey(e, () => choose(current), move)}
        />
        <div className="bd-filter-bar">
          <Button
            className="bd-filters-toggle"
            variant="default"
            leftSection={<Funnel size={16} aria-hidden="true" />}
            aria-expanded={filtersOpen}
            aria-controls={`${id}-filters`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {filterCount > 0 ? t('Filters ({count})', { count: filterCount }) : t('Filters')}
          </Button>
        </div>
        <div className="bd-filters" id={`${id}-filters`} data-open={filtersOpen}>
          {kind.selects.map((s, i) => (
            <Select
              key={s.label}
              label={t(s.label)}
              placeholder={t('Any')}
              data={options[i] ?? []}
              value={picked[i] || null}
              searchable
              clearable
              nothingFoundMessage={t(s.nothingFound)}
              onChange={(v) =>
                setPicked((p) => kind.selects.map((_, j) => (j === i ? (v ?? '') : (p[j] ?? ''))))
              }
            />
          ))}
          {filters}
          {designs.length > 0 && (
            <SegmentedControl
              aria-label={t('Source')}
              data={[
                { value: 'all', label: t('All') },
                { value: 'catalogue', label: t('Catalogue') },
                { value: 'designs', label: t('My designs') },
              ]}
              value={origin}
              onChange={(v) => setOrigin(v as typeof origin)}
            />
          )}
          <Select
            className="bd-sort"
            label={t('Sort by')}
            data={kind.sorts.map((o) => ({ value: o.value, label: t(o.label) }))}
            value={sort}
            allowDeselect={false}
            onChange={(v) => {
              if (!v) return
              setSort(v)
              // the choice reorders the list under the search box, which keeps the focus
              searchBox.current?.focus()
            }}
          />
        </div>
        {chips}
        <p role="status" className="search-status bd-status">
          {message}
        </p>
        <div className="bd-body">
          <Results
            status={state.status}
            retry={read.retry}
            shown={shown}
            kind={kind}
            id={id}
            active={active}
            system={system}
            onActive={setActive}
            onChoose={choose}
          />
          {current && !phone && <Preview row={current} kind={kind} system={system} />}
        </div>
      </div>
    </AppModal>
  )
}

function Preview<R extends ChooserRow>({
  row,
  kind,
  system,
}: {
  row: R
  kind: ChooserKind<R>
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const href = row.origin ? undefined : kind.href?.(row)
  return (
    <aside className="bd-preview" aria-label={t(kind.texts.preview)}>
      <p className="bd-preview-title">{row.name}</p>
      <dl>
        {kind.facts(row, system, t).map(([k, v]) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>{v ?? t('n/a')}</dd>
          </div>
        ))}
      </dl>
      {href && (
        <Link href={href} target="_blank" rel="noopener">
          {t('Open the record')}
          <span className="visually-hidden"> {t('in a new tab')}</span>
        </Link>
      )}
    </aside>
  )
}
