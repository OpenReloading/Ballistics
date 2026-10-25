'use client'

import { useDebouncedValue } from '@mantine/hooks'
import { type createSpotlight, Spotlight, spotlight } from '@mantine/spotlight'
import type { CartridgeDiameters } from '@open-reloading/core'
import { useEffect, useRef, useState } from 'react'
import type { BulletSummary, CartridgeSummary, PowderSummary } from '../lib/api-types.ts'
import type { BulletRow } from '../lib/bullet-rows.ts'
import { findBullets } from '../lib/bullet-search.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { cartridgeOptionText } from '../lib/standards.ts'
import { searchRecords } from './record-search.tsx'
import { searchHost } from './search-host.ts'
import { type Command, useShellActions } from './shell-actions.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'

const noDesigns: readonly BulletRow[] = []

type Found = {
  cartridges: CartridgeSummary[]
  bullets: BulletRow[]
  powders: PowderSummary[]
}

/**
 * The search of each record kind, 8 matches each: cartridges and powders by the API, bullets by
 * the browser's ranking (`findBullets`, the card's field and dialog) over `designs` and the
 * catalogue, kept to those that fit `fit`.
 */
export async function paletteSearch(
  text: string,
  designs: readonly BulletRow[],
  fit: CartridgeDiameters | undefined,
  signal: AbortSignal,
): Promise<Found> {
  const get = async <T,>(kind: string) => (await searchRecords<T>(kind, text, 8, '', signal)).items
  const [cartridges, bullets, powders] = await Promise.allSettled([
    get<CartridgeSummary>('cartridges'),
    findBullets(designs, text, 8, fit).then((found) => found.items),
    get<PowderSummary>('powders'),
  ])
  const kept = <T,>(r: PromiseSettledResult<T[]>) => (r.status === 'fulfilled' ? r.value : [])
  // an API failure keeps the bullets found, the designs among them
  if (bullets.status === 'fulfilled' && bullets.value.length > 0)
    return { cartridges: kept(cartridges), bullets: bullets.value, powders: kept(powders) }
  for (const r of [cartridges, bullets, powders]) if (r.status === 'rejected') throw r.reason
  return { cartridges: kept(cartridges), bullets: kept(bullets), powders: kept(powders) }
}

/**
 * Record search of the workbench (`@mantine/spotlight`): Ctrl+K (Cmd+K), also from a field, or
 * `spotlight.open()`; groups Pages, Commands (the page's, then the shell's), Cartridges, Bullets
 * (those that fit `bulletFit`; named by `bulletsLabel`) and Powders. Ctrl+Enter in the search
 * closes it and runs. The site search of every other page (`site-search.tsx`) is this one on
 * a store of its own (`search`), opened by the shell, without `onRun`.
 */
export function WorkbenchSearch({
  commands: pageCommands,
  onRun,
  onCartridge,
  onBullet,
  onPowder,
  describeBullet,
  designs = noDesigns,
  bulletFit,
  bulletsLabel,
  search: own,
}: {
  commands: Command[]
  onRun?: () => void
  onCartridge: (c: CartridgeSummary) => void
  onBullet: (b: BulletRow) => void
  onPowder: (p: PowderSummary) => void
  describeBullet: (b: BulletSummary) => string
  /** The browser's bullet designs as rows (`userBulletRows`), listed with the catalogue. */
  designs?: readonly BulletRow[]
  /** Extra query of the bullet search, for example `&cartridge=308-win`. */
  bulletFit?: CartridgeDiameters
  bulletsLabel: string
  /** A store of its own, opened by the caller (no shortcut); without it the default store on Ctrl+K. */
  search?: ReturnType<typeof createSpotlight>
}) {
  const [store, actions] = own ?? [undefined, spotlight]
  const shell = useShellActions()
  const names = useManufacturerNames()
  const commands = [...pageCommands, ...shell.commands]
  // the shell's Search and Ctrl+K open this one while it is the page's
  useEffect(() => {
    if (own) return
    searchHost.page = spotlight.open
    if (searchHost.wanted) {
      searchHost.wanted = false
      spotlight.open()
    }
    return () => {
      searchHost.page = undefined
    }
  }, [own])
  const [query, setQuery] = useState('')
  // a command or Ctrl+Enter runs once the search has closed and returned focus, so a run that
  // focuses an invalid field keeps that focus
  const after = useRef<(() => void) | undefined>(undefined)
  const [text] = useDebouncedValue(query.trim(), 200)
  const [found, setFound] = useState<Found | 'error' | undefined>(undefined)
  const fitKey = bulletFit && `${bulletFit.g1} ${bulletFit.land} ${bulletFit.groove}`
  const shownFit = useRef(fitKey)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fitKey` stands for the fit
  useEffect(() => {
    // bullets of another cartridge must not stay choosable while the new search runs
    if (shownFit.current !== fitKey) {
      shownFit.current = fitKey
      setFound(undefined)
    }
    if (!text) {
      setFound(undefined)
      return
    }
    const controller = new AbortController()
    paletteSearch(text, designs, bulletFit, controller.signal)
      .then((f) => {
        if (!controller.signal.aborted) setFound(f)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFound('error')
      })
    return () => controller.abort()
  }, [text, fitKey, designs])

  const lower = query.trim().toLowerCase()
  const shown = commands.filter((c) => c.label.toLowerCase().includes(lower))
  const pages = shell.pages.filter((c) => c.label.toLowerCase().includes(lower))
  const records = typeof found === 'object' ? found : undefined
  const none =
    shown.length + pages.length === 0 &&
    (!records || records.cartridges.length + records.bullets.length + records.powders.length === 0)
  return (
    <Spotlight.Root
      store={store}
      shortcut={own ? null : undefined}
      query={query}
      onQueryChange={setQuery}
      tagsToIgnore={[]}
      transitionProps={{
        duration: 200,
        transition: 'pop',
        onExited: () => {
          const run = after.current
          after.current = undefined
          run?.()
        },
      }}
      scrollable
      maxHeight="min(28rem, 60dvh)"
    >
      {/* caught before the search input, whose Enter would also trigger the selected action */}
      <div
        onKeyDownCapture={(e) => {
          if (!onRun || e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return
          e.preventDefault()
          e.stopPropagation()
          after.current = onRun
          actions.close()
        }}
      >
        <Spotlight.Search
          aria-label="Search pages, cartridges, bullets, powders and commands"
          placeholder="Search pages, cartridges, bullets, powders"
        />
      </div>
      <Spotlight.ActionsList>
        {pages.length > 0 && (
          <Spotlight.ActionsGroup label="Pages">
            {pages.map((c) => (
              <Spotlight.Action
                key={c.label}
                label={c.label}
                onClick={() => {
                  after.current = c.run
                }}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {shown.length > 0 && (
          <Spotlight.ActionsGroup label="Commands">
            {shown.map((c) => (
              <Spotlight.Action
                key={c.label}
                label={c.label}
                rightSection={
                  c.keys && (
                    <span aria-hidden="true">
                      <kbd className="search-keys">{c.keys}</kbd>
                    </span>
                  )
                }
                onClick={() => {
                  after.current = c.run
                }}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {records && records.cartridges.length > 0 && (
          <Spotlight.ActionsGroup label="Cartridges">
            {records.cartridges.map((c) => (
              <Spotlight.Action
                key={c.id}
                label={cartridgeOptionText(c)}
                onClick={() => onCartridge(c)}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {records && records.bullets.length > 0 && (
          <Spotlight.ActionsGroup label={bulletsLabel}>
            {records.bullets.map((b) => (
              <Spotlight.Action
                key={b.id}
                label={b.origin ? `${b.name} (your design)` : describeBullet(b as BulletSummary)}
                onClick={() => onBullet(b)}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {records && records.powders.length > 0 && (
          <Spotlight.ActionsGroup label="Powders, by manufacturer and name (order by load tables)">
            {records.powders.map((p) => (
              <Spotlight.Action
                key={p.id}
                label={productLabel(p, names)}
                onClick={() => onPowder(p)}
              />
            ))}
          </Spotlight.ActionsGroup>
        )}
        {found === 'error' && <Spotlight.Empty>The database is unreachable.</Spotlight.Empty>}
        {found !== 'error' && none && text && <Spotlight.Empty>Nothing found</Spotlight.Empty>}
      </Spotlight.ActionsList>
    </Spotlight.Root>
  )
}
