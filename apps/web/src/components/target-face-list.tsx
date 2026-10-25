'use client'

import { Button, Select } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { compareNames } from '../lib/face-order.ts'
import { listTitles } from '../lib/list-titles.ts'
import { countText, filterText } from '../lib/lists.ts'
import type { Origin } from '../lib/sources.ts'
import { distanceText, type TargetFaceRow, targetFaceMatches } from '../lib/target-faces.ts'
import { controlSize } from '../lib/theme.ts'
import { formatQuantity } from '../lib/units.ts'
import {
  type DirectoryColumn,
  DirectoryFilters,
  DirectoryTable,
  useListState,
} from './directory-table.tsx'
import { SourceFilter } from './list-sources.tsx'
import { BarCount, PageBar } from './page-bar.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

/** Target faces are rule-book records only: the catalogue is the list's one source. */
const faceSources: readonly Origin[] = ['openreloading']

/** The target face directory: name, federation or issuer, distances, outer diameter, rings, disciplines. */
export function TargetFaceList({ items }: { items: TargetFaceRow[] }) {
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const [proto, setProto] = useState('')
  useEffect(() => setProto(new URLSearchParams(window.location.search).get('proto') ?? ''), [])
  const organizations = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap((r) => (proto ? r.used.map((u) => u.organization) : [r.organization])),
        ),
      ].sort(compareNames),
    [items, proto],
  )
  const expanded = useMemo(
    () =>
      proto === 'c'
        ? items.flatMap((r) =>
            r.used.map((u) => ({
              ...r,
              id: `${r.id}~${u.organization}`,
              faceId: r.id,
              organization: u.organization,
              used: [u],
              disciplines: r.disciplines,
            })),
          )
        : items,
    [items, proto],
  )
  const shown = useMemo(
    () => expanded.filter((r) => targetFaceMatches(r, filters, Boolean(proto))),
    [expanded, filters, proto],
  )
  const active = state.organization || state.query.trim()
  /** The event names under the picked federation, else the ones the search words hit. */
  const matching = (r: TargetFaceRow) => {
    const words = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const names = (
      state.organization ? r.used.filter((u) => u.organization === state.organization) : r.used
    ).flatMap((u) => u.names)
    const hit = words.length
      ? names.filter((n) => words.every((w) => n.toLowerCase().includes(w)))
      : names
    const list = hit.length ? hit : names
    return list.length > 1 ? `${list[0]}, +${list.length - 1}` : (list[0] ?? '')
  }
  const alsoText = (r: TargetFaceRow) =>
    [
      r.organization,
      ...(r.used.length > 1
        ? [
            `also ${r.used
              .slice(1)
              .map((u) => u.organization)
              .join(', ')}`,
          ]
        : []),
    ]
      .join(', ')
      .replace(', also', ', also')
  const named = [state.organization, state.query.trim() && `matching "${state.query.trim()}"`]
  const outer = (r: TargetFaceRow) => formatQuantity('length', system, toSi('length', r.outer))
  const columns: DirectoryColumn<TargetFaceRow>[] = [
    { key: 'name', label: 'Name', value: (r) => r.name, cell: (r) => r.name },
    {
      key: 'organization',
      label: 'Federation',
      width:
        proto === 'b'
          ? '17rem'
          : proto === 'a' || proto === 'd' || proto === 'e'
            ? '14rem'
            : '7rem',
      value: (r) => r.organization,
      cell: (r) =>
        proto === 'a' || proto === 'd' || proto === 'e' ? (
          alsoText(r)
        ) : proto === 'b' ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {r.used.map((u, i) => (
              <span
                key={u.organization}
                style={{
                  padding: '0 6px',
                  border: '1px solid var(--border)',
                  fontWeight: i === 0 ? 600 : 400,
                  fontSize: 12,
                }}
              >
                {u.organization}
                {i > 0 || u.events > 1 ? ` ${u.events}` : ''}
              </span>
            ))}
          </span>
        ) : (
          r.organization
        ),
    },
    ...(proto === 'd' && active
      ? [
          {
            key: 'names',
            label: state.organization ? `Names under ${state.organization}` : 'Matching names',
            width: '20rem',
            cell: (r: TargetFaceRow) => matching(r),
          } satisfies DirectoryColumn<TargetFaceRow>,
        ]
      : []),
    {
      key: 'distance',
      label: 'Distance',
      unit: 'm',
      width: '8rem',
      value: (r) => r.distances[0],
      cell: (r) => r.distances.join(', '),
    },
    {
      key: 'outer',
      label: 'Outer diameter',
      unit: system.length.symbol,
      num: true,
      width: '8rem',
      value: (r) => r.outer,
      cell: outer,
    },
    {
      key: 'rings',
      label: 'Rings',
      num: true,
      width: '5rem',
      value: (r) => r.rings,
      cell: (r) => r.rings,
    },
    {
      key: 'disciplines',
      label: 'Disciplines',
      num: true,
      width: '7rem',
      value: (r) => r.disciplines,
      cell: (r) => r.disciplines,
    },
  ]
  const facts = (r: TargetFaceRow) =>
    [
      ...(proto === 'e' && active ? [matching(r)] : []),
      proto === 'a' || proto === 'd' || proto === 'e'
        ? alsoText(r)
        : proto === 'b'
          ? r.used.map((u, i) => (i ? `${u.organization} ${u.events}` : u.organization)).join(', ')
          : r.organization,
      distanceText(r.distances),
      `${outer(r)} ${system.length.symbol}`,
      `${r.rings} rings`,
    ].join(' · ')
  return (
    <>
      {proto === 'e' && active && (
        <style>{`@media (min-width: 48em) { .directory-table tr[data-row] { height: 3rem } .directory-table .facts { display: block; -webkit-line-clamp: 1; line-clamp: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap } .directory-table td.name-cell > * { display: block } }`}</style>
      )}
      <PageBar
        title={listTitles.targets}
        status={
          <BarCount widest={`${items.length} of ${countText(items.length, items.length, 'faces')}`}>
            {countText(shown.length, items.length, 'faces')}
          </BarCount>
        }
        actions={
          <>
            <Button
              component={Link}
              href="/targets/designer"
              leftSection={<Plus aria-hidden="true" />}
            >
              New face
            </Button>
            <UnitsIconButton />
          </>
        }
      />
      <div className="directory">
        <DirectoryFilters
          query={state.query}
          onQuery={(q) => set({ query: q })}
          placeholder="Name, federation or event, 25 m…"
          active={Boolean(state.query || state.organization)}
          onClear={clear}
          sorting={{ columns, sort: state.sort, onSort: (sort) => set({ sort }) }}
        >
          <SourceFilter
            src={state.sources}
            counts={{ openreloading: items.length, user: 0 }}
            sources={faceSources}
            onChange={(src) => set({ sources: src })}
          />
          <Select
            aria-label="Federation"
            placeholder="Federation"
            size={controlSize.row.input}
            clearable
            data={organizations}
            value={state.organization || null}
            onChange={(v) => set({ organization: v ?? '' })}
          />
        </DirectoryFilters>
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(r) => `/targets/${(r as TargetFaceRow & { faceId?: string }).faceId ?? r.id}`}
          facts={facts}
          label={(r) => r.name}
          caption={
            named.filter(Boolean).length === 0
              ? 'All target faces'
              : `Target faces, ${named.filter(Boolean).join(', ')}`
          }
          noun="faces"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="target faces" filters={filterText(named)} />}
        />
      </div>
    </>
  )
}
