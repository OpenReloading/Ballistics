'use client'

import { Button, Checkbox, Group, Popover, Stack } from '@mantine/core'
import { CaretDown } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { DirectoryState } from '../lib/directory.ts'
import { type Facet, type FacetOption, facetOptions, facetRows } from '../lib/facets.ts'
import { controlSize } from '../lib/theme.ts'
import { AppPopover } from './app-popover.tsx'

/**
 * The rows `base` (the list after its search and source) that pass the choice filters of
 * `state`, and the options of each filter with the counts the other choices leave.
 */
export function useFacets<T>(
  all: readonly T[],
  base: readonly T[],
  facets: readonly Facet<T>[],
  state: DirectoryState,
) {
  const selected = state.facets ?? noChoice
  return useMemo(
    () => ({
      shown: facetRows(base, facets, selected),
      options: facetOptions(all, base, facets, selected),
    }),
    [all, base, facets, selected],
  )
}

const noChoice: Record<string, string[]> = {}

/**
 * The choice filters of a list: one button per filter that has two values or more, naming the
 * choice, and a popover with a checkbox and a row count per option. Clear all is there while a
 * choice is set.
 */
export function FacetFilters<T>({
  facets,
  options,
  state,
  onChange,
  onClear,
}: {
  facets: readonly Facet<T>[]
  options: ReadonlyMap<string, FacetOption[]>
  state: DirectoryState
  onChange: (facets: Record<string, string[]>) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const selected = state.facets ?? noChoice
  const set = facets.some((f) => (selected[f.key]?.length ?? 0) > 0)
  return (
    <>
      {facets.map((f) => {
        const list = options.get(f.key)
        if (!list) return null
        const on = selected[f.key] ?? []
        const text =
          on.length === 0
            ? t(f.label)
            : `${t(f.label)}: ${on.length === 1 ? (list.find((o) => o.value === on[0])?.text ?? on[0]) : on.length}`
        return (
          <AppPopover key={f.key} position="bottom-start" trapFocus>
            <Popover.Target>
              <Button
                className="source-filter"
                data-set={on.length > 0 || undefined}
                variant="default"
                size={controlSize.row.button}
                aria-haspopup="dialog"
                rightSection={<CaretDown size={12} aria-hidden="true" />}
                justify="space-between"
              >
                {text}
              </Button>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap={8} className="facet-options" role="group" aria-label={t(f.label)}>
                {list.map((o) => {
                  const checked = on.includes(o.value)
                  return (
                    <Checkbox
                      key={o.value}
                      checked={checked}
                      disabled={!checked && o.count === 0}
                      label={
                        <Group component="span" justify="space-between" gap="md" wrap="nowrap">
                          <span>{o.text}</span>
                          <span className="source-count">{o.count}</span>
                        </Group>
                      }
                      onChange={() =>
                        onChange({
                          ...selected,
                          [f.key]: checked ? on.filter((v) => v !== o.value) : [...on, o.value],
                        })
                      }
                    />
                  )
                })}
              </Stack>
            </Popover.Dropdown>
          </AppPopover>
        )
      })}
      {set && (
        <Button variant="subtle" size={controlSize.row.button} onClick={onClear}>
          {t('Clear all')}
        </Button>
      )}
    </>
  )
}
