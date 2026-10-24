'use client'

import {
  Badge,
  Button,
  Loader,
  NumberInput,
  Pill,
  SegmentedControl,
  Select,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { CartridgeDiameters } from '@open-reloading/core'
import { Funnel, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react'
import {
  type BulletItem,
  type BulletRow,
  ballisticCoefficientText,
  bulletBallisticCoefficient,
  bulletCells,
} from '../lib/bullet-rows.ts'
import { type BulletSort, fetchBulletCatalogue, searchBullets } from '../lib/bullet-search.ts'
import { caliberOptions } from '../lib/caliber.ts'
import { manufacturerOptions } from '../lib/manufacturers.ts'
import type { UnitSystem } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { EmptyNote, ErrorNote } from './states.tsx'

/** Rows drawn at once: a narrower search shows the rest. */
const shownRows = 100

const sortOptions: { value: BulletSort; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'name', label: 'Manufacturer and name' },
  { value: 'mass', label: 'Heaviest first' },
  { value: 'ballisticCoefficient', label: 'Highest BC first' },
]

type Catalogue = { status: 'loading' } | { status: 'ok'; rows: BulletItem[] } | { status: 'error' }

/** The catalogue is read when the dialog first opens, again after Retry. */
function useCatalogue(opened: boolean) {
  const [state, setState] = useState<Catalogue>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reads it again
  useEffect(() => {
    if (!opened || state.status === 'ok') return
    let live = true
    setState({ status: 'loading' })
    fetchBulletCatalogue().then(
      (rows) => live && setState({ status: 'ok', rows }),
      () => live && setState({ status: 'error' }),
    )
    return () => {
      live = false
    }
  }, [opened, attempt])
  return { state, retry: () => setAttempt((n) => n + 1) }
}

const massText = (row: BulletRow, system: UnitSystem, cells: ReturnType<typeof bulletCells>) =>
  row.mass === null ? 'n/a' : `${cells.mass} ${system.mass.symbol}`

/**
 * The bullet picker of a workbench card as a dialog: a search box over the whole catalogue and the
 * browser's own designs (several words in any order, a caliber such as 308, a weight such as 168
 * or 10.9g), filters, a result list and a preview of the highlighted bullet. The search box keeps
 * the focus: arrow keys highlight, Enter or a click chooses. `fit` keeps the bullets that fit the
 * cartridge until its chip is removed.
 */
export function BulletSearchDialog({
  opened,
  onClose,
  text,
  designs,
  fit,
  fitName,
  system,
  onChoose,
}: {
  opened: boolean
  onClose: () => void
  /** What the card's field held when the dialog was opened. */
  text: string
  /** The browser's bullet designs as rows (`userBulletRows`). */
  designs: readonly BulletRow[]
  fit?: CartridgeDiameters
  fitName?: string
  system: UnitSystem
  onChoose: (row: BulletRow) => void
}) {
  const { state, retry } = useCatalogue(opened)
  const phone = useMediaQuery('(max-width: 47.99em)')
  const [query, setQuery] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [caliber, setCaliber] = useState('')
  const [from, setFrom] = useState<string | number>('')
  const [to, setTo] = useState<string | number>('')
  const [origin, setOrigin] = useState<'all' | 'catalogue' | 'designs'>('all')
  const [sort, setSort] = useState<BulletSort>('relevance')
  const [fitOn, setFitOn] = useState(true)
  const [active, setActive] = useState(0)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const id = useId()

  // each opening starts from the card's text, the cartridge fit and no other filter
  // biome-ignore lint/correctness/useExhaustiveDependencies: on opening only
  useEffect(() => {
    if (!opened) return
    setQuery(text)
    setManufacturer('')
    setCaliber('')
    setFrom('')
    setTo('')
    setOrigin('all')
    setSort('relevance')
    setFitOn(true)
    setFiltersOpen(false)
  }, [opened])

  const catalogue = state.status === 'ok' ? state.rows : []
  const rows = useMemo<BulletRow[]>(() => [...designs, ...catalogue], [designs, catalogue])
  const typed = useDeferredValue(query)
  const massUnit = system.mass.symbol === 'gr' ? 'gr' : 'g'
  const mass = from === '' && to === '' ? '' : `${from}-${to}${massUnit}`
  const results = useMemo(
    () =>
      searchBullets(
        rows,
        typed,
        {
          manufacturer,
          caliber,
          mass,
          fit: fitOn ? fit : undefined,
          origin: origin === 'all' ? undefined : origin,
        },
        sort,
      ),
    [rows, typed, manufacturer, caliber, mass, fitOn, fit, origin, sort],
  )
  // after a failed read only the error shows, so no listbox or highlight is left behind
  const shown = state.status === 'error' ? [] : results.slice(0, shownRows)
  // another list highlights its first bullet; the same list, found again, keeps the highlight
  const listKey = `${results.length}:${results[0]?.id}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the list
  useEffect(() => setActive(0), [listKey])
  const current = shown[Math.min(active, shown.length - 1)]
  const optionId = (i: number) => `${id}-option-${i}`
  useEffect(() => {
    if (opened && current)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, opened, current, id])

  const manufacturers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of catalogue) counts.set(r.manufacturer, (counts.get(r.manufacturer) ?? 0) + 1)
    return manufacturerOptions(catalogue).map((o) => ({
      ...o,
      label: `${o.label} (${counts.get(o.value)})`,
    }))
  }, [catalogue])
  const calibers = useMemo(() => caliberOptions(rows.map((r) => r.diameter)), [rows])
  const filterCount = [manufacturer, caliber, mass, origin !== 'all' && origin].filter(
    Boolean,
  ).length

  const total = rows.length
  let message = ''
  if (state.status === 'loading') message = 'Loading bullets'
  else if (state.status === 'ok')
    message =
      results.length === total
        ? `${total} bullets`
        : `${results.length} of ${total} bullets${results.length > shownRows ? `, first ${shownRows} shown` : ''}`

  function move(by: number) {
    if (shown.length === 0) return
    setActive((i) => Math.max(0, Math.min(shown.length - 1, i + by)))
  }

  function choose(row: BulletRow | undefined) {
    if (row) onChoose(row)
  }

  const list = shown.length > 0
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Choose a bullet"
      size="64rem"
      fullScreen={phone}
      className="bd-modal"
      closeButton={{ 'aria-label': 'Close the bullet search' }}
    >
      <div className="bd">
        <TextInput
          data-autofocus
          label="Search bullets"
          description="Words of the manufacturer or name in any order, a caliber such as 308, a weight such as 168 or 10.9g"
          autoComplete="off"
          value={query}
          rightSection={state.status === 'loading' ? <Loader size="xs" /> : undefined}
          onChange={(e) => setQuery(e.currentTarget.value)}
          role="combobox"
          aria-expanded={list}
          aria-controls={list ? `${id}-list` : undefined}
          aria-activedescendant={list ? optionId(active) : undefined}
          aria-autocomplete="list"
          onKeyDown={(e) => {
            // Ctrl+Enter (Cmd+Enter) stays free for the calculator's run shortcut
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              choose(current)
            } else if (
              e.key === 'ArrowDown' ||
              e.key === 'ArrowUp' ||
              e.key === 'PageDown' ||
              e.key === 'PageUp'
            ) {
              e.preventDefault()
              move(
                e.key === 'ArrowDown'
                  ? 1
                  : e.key === 'ArrowUp'
                    ? -1
                    : e.key === 'PageDown'
                      ? 8
                      : -8,
              )
            }
          }}
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
            Filters{filterCount > 0 ? ` (${filterCount})` : ''}
          </Button>
        </div>
        <div className="bd-filters" id={`${id}-filters`} data-open={filtersOpen}>
          <Select
            label="Manufacturer"
            placeholder="Any"
            data={manufacturers}
            value={manufacturer || null}
            searchable
            clearable
            nothingFoundMessage="No manufacturer found"
            onChange={(v) => setManufacturer(v ?? '')}
          />
          <Select
            label="Caliber"
            placeholder="Any"
            data={calibers}
            value={caliber || null}
            searchable
            clearable
            nothingFoundMessage="No caliber found"
            onChange={(v) => setCaliber(v ?? '')}
          />
          <fieldset className="bd-mass">
            <legend>Mass ({system.mass.symbol})</legend>
            <NumberInput
              aria-label={`Mass from, ${system.mass.symbol}`}
              placeholder="From"
              min={0}
              hideControls
              value={from}
              onChange={setFrom}
            />
            <NumberInput
              aria-label={`Mass to, ${system.mass.symbol}`}
              placeholder="To"
              min={0}
              hideControls
              value={to}
              onChange={setTo}
            />
          </fieldset>
          {designs.length > 0 && (
            <SegmentedControl
              aria-label="Source"
              data={[
                { value: 'all', label: 'All' },
                { value: 'catalogue', label: 'Catalogue' },
                { value: 'designs', label: 'My designs' },
              ]}
              value={origin}
              onChange={(v) => setOrigin(v as typeof origin)}
            />
          )}
          <Select
            className="bd-sort"
            label="Sort by"
            data={sortOptions}
            value={sort}
            allowDeselect={false}
            onChange={(v) => v && setSort(v as BulletSort)}
          />
        </div>
        {fit && fitOn && (
          <div className="bd-chips">
            <Pill
              withRemoveButton
              onRemove={() => setFitOn(false)}
              removeButtonProps={{ 'aria-label': 'Show bullets of every diameter' }}
            >
              Fits {fitName ?? 'the cartridge'}
            </Pill>
          </div>
        )}
        <p role="status" className="search-status bd-status">
          {message}
        </p>
        <div className="bd-body">
          {state.status === 'error' ? (
            <ErrorNote title="The bullets could not be read." onRetry={retry}>
              The server did not answer. The designer and the workbench still work.
            </ErrorNote>
          ) : state.status === 'ok' && !list ? (
            <EmptyNote
              icon={<MagnifyingGlass size={20} aria-hidden="true" />}
              title="No bullet matches"
              description="Remove a filter or a word."
            />
          ) : (
            list && (
              <div className="bd-list-wrap">
                <div className="bd-head" aria-hidden="true">
                  <span>Bullet</span>
                  <span>Caliber</span>
                  <span>Mass</span>
                  <span>BC</span>
                </div>
                <div id={`${id}-list`} role="listbox" aria-label="Bullets" className="bd-list">
                  {shown.map((row, i) => {
                    const cells = bulletCells(row, system)
                    const bc = bulletBallisticCoefficient(row, undefined)
                    const mass = massText(row, system, cells)
                    const bcText = bc ? ballisticCoefficientText(bc) : 'n/a'
                    return (
                      // keyboard: the search box owns the focus and moves the highlight
                      // biome-ignore lint/a11y/useKeyWithClickEvents: see above
                      <div
                        key={row.id}
                        id={optionId(i)}
                        role="option"
                        tabIndex={-1}
                        // the search box keeps the focus when a row is pressed
                        onMouseDown={(e) => e.preventDefault()}
                        aria-selected={i === active}
                        className="bd-row"
                        data-active={i === active || undefined}
                        onMouseMove={() => i !== active && setActive(i)}
                        onClick={() => choose(row)}
                      >
                        <span className="bd-name">
                          {row.manufacturerName && (
                            <span className="bd-maker">{row.manufacturerName}</span>
                          )}
                          <span>
                            {row.name}
                            {row.origin && (
                              <Badge ml="xs" variant="light">
                                Your design
                              </Badge>
                            )}
                          </span>
                        </span>
                        <span>{cells.caliber}</span>
                        <span>{mass}</span>
                        <span>{bcText}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}
          {current && !phone && <Preview row={current} system={system} />}
        </div>
      </div>
    </AppModal>
  )
}

function Preview({ row, system }: { row: BulletRow; system: UnitSystem }) {
  const cells = bulletCells(row, system)
  const bc = bulletBallisticCoefficient(row, undefined)
  const facts: [string, string | undefined][] = [
    ['Manufacturer', row.manufacturerName || undefined],
    ['Caliber', cells.caliber],
    ['Diameter', cells.diameter],
    ['Mass', row.mass === null ? undefined : `${cells.mass} ${system.mass.symbol}`],
    ['Length', row.length === null ? undefined : `${cells.length} ${system.length.symbol}`],
    [
      'BC',
      bc
        ? [bc, bc.other].flatMap((x) => (x ? [ballisticCoefficientText(x)] : [])).join(', ')
        : undefined,
    ],
    ['Construction', row.construction],
    ['Tip', row.tipType],
    ['Country', row.country],
  ]
  return (
    <aside className="bd-preview" aria-label="Highlighted bullet">
      <p className="bd-preview-title">{row.name}</p>
      <dl>
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ?? 'n/a'}</dd>
          </div>
        ))}
      </dl>
      {!row.origin && (
        <Link href={`/bullets/${row.id}`} target="_blank" rel="noopener">
          Open the record<span className="visually-hidden"> in a new tab</span>
        </Link>
      )}
    </aside>
  )
}
