'use client'

import { Button, Tooltip } from '@mantine/core'
import { ArrowsLeftRight, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useId } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { togglePick } from '../lib/selection.ts'
import { controlSize } from '../lib/theme.ts'
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

/**
 * The picks for the page bar's status line, after the list's count: "2 selected (max 4)" and
 * Clear, which unticks them all; the ticked rows show which. One line of fixed height, so a pick
 * moves nothing.
 */
export function SelectionSummary({
  count,
  max,
  onClear,
}: {
  count: number
  max: number
  onClear: () => void
}) {
  const { t } = useTranslation()
  // Clear leaves with the picks: the focus goes to the search box
  const clear = () => {
    onClear()
    focusSearch()
  }
  return (
    <span className="selection-summary" data-picked={count > 0 || undefined}>
      {/* only the text is live: the button is no news */}
      <span aria-live="polite" className="selection-count">
        {count > 0 && t('{count} selected (max {max})', { count, max })}
      </span>
      {count > 0 && (
        <Button
          className="clear-picks"
          variant="subtle"
          size={controlSize.row.button}
          px={6}
          aria-label={t('Clear selection')}
          leftSection={<X size={12} aria-hidden="true" />}
          onClick={clear}
        >
          <span className="clear-picks-text">{t('Clear')}</span>
        </Button>
      )}
    </span>
  )
}

/**
 * "Compare n" to `href` from `min` picks; below that a disabled button saying how many it needs.
 * `idle` names the button without picks (a page that opens empty). With `max`, the button keeps
 * the width of "Compare max", so the buttons beside it do not shift with a pick.
 */
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
  const { t } = useTranslation()
  const text = count > 0 ? t('Compare {count}', { count }) : (idle ?? t('Compare'))
  // the widest label under the shown one, unseen: the slot's width
  const label =
    max === undefined ? (
      text
    ) : (
      <span className="compare-label">
        <span>{text}</span>
        <span aria-hidden="true">{t('Compare {count}', { count: max })}</span>
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
