'use client'

import { useLingui } from '@lingui/react'
import { Button, Popover, Tooltip } from '@mantine/core'
import { ArrowLeftRight, EyeOff, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import Link from '@/platform/link.tsx'
import { togglePick } from '../lib/selection.ts'
import { controlSize } from '../lib/theme.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { focusSearch } from './directory-table.tsx'

/** In the order ticked, at most `max`, kept in the URL as `pick`; ids that `known` does not hold are left out. */
export function usePicks(
  max: number,
  pick: string | undefined,
  onChange: (pick: string) => void,
  known: (id: string) => boolean,
) {
  const picked = [...new Set((pick ?? '').split(','))].filter((id) => id && known(id)).slice(0, max)
  const toggle = (id: string) => onChange(togglePick(picked, id, max).join(','))
  const replace = (ids: readonly string[]) => onChange(ids.join(','))
  return [picked, toggle, replace] as const
}

/** A pick the search or a filter hides, named as its row. */
export type HiddenPick = { id: string; label: string }

/** The picks not among the `shown` rows, in the order ticked. */
export function hiddenPicks<T extends { id: string }>(
  picked: readonly string[],
  shown: readonly T[],
  items: readonly T[],
  label: (row: T) => string,
): HiddenPick[] {
  if (picked.length === 0) return []
  const seen = new Set(shown.map((r) => r.id))
  const rows = new Map(items.map((r) => [r.id, r]))
  return picked.flatMap((id) => {
    const row = rows.get(id)
    return row && !seen.has(id) ? [{ id, label: label(row) }] : []
  })
}

/** One line of fixed height, so a pick moves nothing; `hidden` opens a list of the picks the rows do not show, each with its untick. */
export function SelectionSummary({
  count,
  max,
  hidden,
  onUntick,
  onClear,
}: {
  count: number
  max: number
  hidden: readonly HiddenPick[]
  onUntick: (id: string) => void
  onClear: () => void
}) {
  const { i18n } = useLingui()
  // Clear leaves with the picks: the focus goes to the search box
  const clear = () => {
    onClear()
    focusSearch()
  }
  return (
    <span className="selection-summary" data-picked={count > 0 || undefined}>
      {/* only the text is live: the buttons are no news */}
      <span aria-live="polite" className="selection-count">
        {count > 0 && (
          <>
            <span className="selection-count-short" aria-hidden="true">
              {i18n._({
                id: 'comparePicks.selected',
                message: '{count} selected',
                values: { count },
              })}
            </span>
            <span className="selection-count-text">
              {i18n._({
                id: 'comparePicks.selectedMax',
                message: '{count} selected (max {max})',
                values: { count, max },
              })}
            </span>
          </>
        )}
      </span>
      {hidden.length > 0 && <HiddenPicks hidden={hidden} onUntick={onUntick} />}
      {count > 0 && (
        <Button
          className="clear-picks"
          variant="subtle"
          size={controlSize.row.button}
          px={6}
          aria-label={i18n._({ id: 'comparePicks.clearSelection', message: 'Clear selection' })}
          leftSection={<X size={12} aria-hidden="true" />}
          onClick={clear}
        >
          <span className="clear-picks-text">
            {i18n._({ id: 'comparePicks.clear', message: 'Clear' })}
          </span>
        </Button>
      )}
    </span>
  )
}

function HiddenPicks({
  hidden,
  onUntick,
}: {
  hidden: readonly HiddenPick[]
  onUntick: (id: string) => void
}) {
  const { i18n } = useLingui()
  const title = useId()
  const list = useRef<HTMLUListElement>(null)
  // the row of the untick just clicked: its button goes, the focus moves to the one now in its place
  const next = useRef<number | null>(null)
  useEffect(() => {
    const at = next.current
    if (at === null) return
    next.current = null
    const buttons = list.current?.querySelectorAll('button')
    buttons?.[Math.min(at, buttons.length - 1)]?.focus()
  }, [hidden.length])
  const untick = (id: string, at: number) => {
    onUntick(id)
    // the last one takes the list and its button along, as Clear does the picks
    if (hidden.length === 1) focusSearch()
    else next.current = at
  }
  return (
    <AppPopover position="bottom-start" width={popoverWidth.help} trapFocus>
      <Popover.Target>
        <Button
          className="hidden-picks"
          variant="subtle"
          size={controlSize.row.button}
          px={6}
          aria-haspopup="dialog"
          leftSection={<EyeOff size={12} aria-hidden="true" />}
        >
          <span className="hidden-picks-count" aria-hidden="true">
            {hidden.length}
          </span>
          <span className="hidden-picks-text">
            {i18n._({
              id: 'comparePicks.hidden',
              message: '{count} hidden',
              values: { count: hidden.length },
            })}
          </span>
        </Button>
      </Popover.Target>
      <Popover.Dropdown aria-labelledby={title}>
        <p id={title} className="hidden-picks-title">
          {i18n._({ id: 'comparePicks.hiddenTitle', message: 'Hidden by the search or a filter' })}
        </p>
        <ul ref={list} className="hidden-picks-list">
          {hidden.map((p, at) => (
            <li key={p.id}>
              <span>{p.label}</span>
              <Button
                variant="subtle"
                size={controlSize.row.button}
                px={6}
                aria-label={i18n._({
                  id: 'comparePicks.untickName',
                  message: 'Untick {name}',
                  values: { name: p.label },
                })}
                leftSection={<X size={12} aria-hidden="true" />}
                onClick={() => untick(p.id, at)}
              >
                {i18n._({ id: 'comparePicks.untick', message: 'Untick' })}
              </Button>
            </li>
          ))}
        </ul>
      </Popover.Dropdown>
    </AppPopover>
  )
}

/** Disabled below `min`, saying how many it needs; with `max` it keeps the width of "Compare max", so the buttons beside it do not shift with a pick. */
export function CompareButton({
  count,
  min,
  max,
  href,
  need,
  idle,
}: {
  count: number
  min: number
  max?: number
  href: string
  need?: string
  idle?: string
}) {
  const { i18n } = useLingui()
  const compareCount = (n: number) =>
    i18n._({ id: 'comparePicks.compareCount', message: 'Compare {count}', values: { count: n } })
  const text =
    count > 0
      ? compareCount(count)
      : (idle ?? i18n._({ id: 'comparePicks.compare', message: 'Compare' }))
  // the widest label under the shown one, unseen: the slot's width
  const label =
    max === undefined ? (
      text
    ) : (
      <span className="compare-label">
        <span>{text}</span>
        <span aria-hidden="true">{compareCount(max)}</span>
      </span>
    )
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
          leftSection={<ArrowLeftRight aria-hidden="true" />}
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
      leftSection={<ArrowLeftRight aria-hidden="true" />}
    >
      {label}
    </Button>
  )
}
