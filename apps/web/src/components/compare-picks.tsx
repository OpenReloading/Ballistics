'use client'

import { Button, CloseButton, Popover, Tooltip } from '@mantine/core'
import { ArrowsLeftRight, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { togglePick } from '../lib/selection.ts'
import { controlSize } from '../lib/theme.ts'
import { AppPopover } from './app-popover.tsx'
import { focusSearch } from './directory-table.tsx'

/**
 * The rows ticked for Compare, in the order ticked, at most `max`, kept in the list's
 * URL as `pick`: ids that `known` does not hold are left out.
 */
export function usePicks(
  max: number,
  pick: string | undefined,
  onChange: (pick: string) => void,
  known: (id: string) => boolean,
) {
  const picked = (pick ?? '')
    .split(',')
    .filter((id) => id && known(id))
    .slice(0, max)
  const toggle = (id: string) => onChange(togglePick(picked, id, max).join(','))
  const replace = (ids: readonly string[]) => onChange(ids.join(','))
  return [picked, toggle, replace] as const
}

/** The picks as removable chips, one `li` each. */
function ChipItems({
  ids,
  name,
  onRemove,
}: {
  ids: readonly string[]
  name: (id: string) => string
  onRemove: (id: string) => void
}) {
  return ids.map((id) => (
    <li key={id}>
      <span title={name(id)}>{name(id)}</span>
      <CloseButton aria-label={`Remove ${name(id)}`} onClick={() => onRemove(id)} />
    </li>
  ))
}

/**
 * The picks for the page bar's status line, after the list's count: "n of max" and one removable
 * chip each, also for rows a filter hides. Chips that do not fit the line's width give way to
 * "n selected" with the full list in a popover, so a pick moves nothing and no name is cut.
 * "Clear selection" unticks them all.
 */
export function PickedChips({
  ids,
  max,
  name,
  onRemove,
  onClear,
}: {
  ids: readonly string[]
  max: number
  name: (id: string) => string
  onRemove: (id: string) => void
  onClear: () => void
}) {
  // the Clear buttons leave with the picks: the focus goes to the search box
  const clear = () => {
    onClear()
    focusSearch()
  }
  const slot = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [over, setOver] = useState(false)
  // the chip list keeps its natural width (hidden while it does not fit), so it can be measured again
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs appear with the first pick
  useLayoutEffect(() => {
    const s = slot.current
    const l = list.current
    if (!s || !l) return
    const measure = () => setOver(l.scrollWidth > s.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(s)
    observer.observe(l)
    measure()
    return () => observer.disconnect()
  }, [ids.length > 0])
  return (
    <>
      <span
        aria-live="polite"
        className={over ? 'selection-count visually-hidden' : 'selection-count'}
      >
        {ids.length > 0 && ` · ${ids.length} of ${max} selected`}
      </span>
      {ids.length > 0 && (
        <div className="picked-slot" data-over={over || undefined} ref={slot}>
          <ul className="picked-chips" aria-label="Selected for Compare" ref={list}>
            <ChipItems ids={ids} name={name} onRemove={onRemove} />
          </ul>
          {over && (
            <AppPopover position="bottom-start" withArrow>
              <Popover.Target>
                <Button size={controlSize.row.button} variant="default" px={6}>
                  {ids.length} selected
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <ul className="picked-list" aria-label="Selected for Compare">
                  <ChipItems ids={ids} name={name} onRemove={onRemove} />
                </ul>
                <Button
                  variant="subtle"
                  size={controlSize.row.button}
                  leftSection={<X size={12} aria-hidden="true" />}
                  onClick={clear}
                >
                  Clear selection
                </Button>
              </Popover.Dropdown>
            </AppPopover>
          )}
        </div>
      )}
      {ids.length > 0 && (
        <Button
          className="clear-picks"
          variant="subtle"
          size={controlSize.row.button}
          px={6}
          aria-label="Clear selection"
          leftSection={<X size={12} aria-hidden="true" />}
          onClick={clear}
        >
          <span className="clear-picks-text">Clear</span>
        </Button>
      )}
    </>
  )
}

/**
 * "Compare n" to `href` from `min` picks; below that a disabled button saying how many it needs.
 * `idle` names the button without picks (a page that opens empty).
 */
export function CompareButton({
  count,
  min,
  href,
  need,
  idle = 'Compare',
}: {
  count: number
  min: number
  href: string
  need?: string
  idle?: string
}) {
  const label = count > 0 ? `Compare ${count}` : idle
  const hint = useId()
  // aria-disabled, not disabled: the button stays focusable, so its hint is read
  return count < min ? (
    <>
      <Tooltip label={need} disabled={!need}>
        <Button
          variant="default"
          data-disabled
          aria-disabled="true"
          aria-describedby={need ? hint : undefined}
          leftSection={<ArrowsLeftRight aria-hidden="true" />}
        >
          {label}
        </Button>
      </Tooltip>
      {need && (
        <span id={hint} className="visually-hidden">
          {need}
        </span>
      )}
    </>
  ) : (
    <Button
      component={Link}
      href={href}
      variant={count > 0 ? 'filled' : 'default'}
      leftSection={<ArrowsLeftRight aria-hidden="true" />}
    >
      {label}
    </Button>
  )
}
