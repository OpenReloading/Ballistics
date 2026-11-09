'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Message } from '../i18n/translate.ts'
import type { DirectoryState } from '../lib/directory.ts'
import { countText, type ListNoun, widestCount } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import { DirectoryFilters, type Scope, type SortColumn } from './directory-table.tsx'
import { LibraryTabs } from './library-tabs.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'

/** The page bar counts `shown` of `total`; `filters` stand beside the search and the source filter. */
export function DirectoryPage({
  title,
  noun,
  shown,
  total,
  status,
  actions,
  state,
  set,
  placeholder,
  columns,
  counts,
  sources,
  scope,
  filters,
  table,
}: {
  title: Message
  noun: ListNoun
  shown: number
  total: number
  /** After the count, such as the selection. */
  status?: ReactNode
  actions?: ReactNode
  state: DirectoryState
  set: (next: Partial<DirectoryState>) => void
  placeholder: string
  columns: readonly SortColumn[]
  counts: Record<Origin, number>
  sources?: readonly Origin[] | undefined
  scope?: Scope | undefined
  /** After the source filter. */
  filters?: ReactNode
  table: ReactNode
}) {
  const tr = useTranslation()
  return (
    <>
      <PageBar
        title={title}
        translated
        status={
          <>
            <BarCount widest={widestCount(tr, total, noun)}>
              {countText(tr, shown, total, noun)}
            </BarCount>
            {status}
          </>
        }
        actions={actions}
      />
      <LibraryTabs />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder={placeholder}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
          scope={scope}
        >
          <SourceFilter
            src={state.sources}
            counts={counts}
            sources={sources}
            onChange={(src) => set({ sources: src })}
          />
          {filters}
        </DirectoryFilters>
        {table}
      </div>
    </>
  )
}
