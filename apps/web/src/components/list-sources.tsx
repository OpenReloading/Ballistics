'use client'

import { useLingui } from '@lingui/react'
import { ActionIcon, Badge, Button, Checkbox, Group, Popover, Stack, Tooltip } from '@mantine/core'
import type { UserRecord } from '@rangefoundry/schema'
import { ChevronDown, Trash } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { deleteRecords, storedRecords } from '@/platform/user-store.ts'
import {
  type Origin,
  originNames,
  originOf,
  origins,
  readOrigins,
  toggleOrigin,
  userRecordId,
} from '../lib/sources.ts'
import { controlSize } from '../lib/theme.ts'
import { AppPopover } from './app-popover.tsx'
import { confirmDialog } from './confirm.tsx'
import type { DirectoryColumn } from './directory-table.tsx'

/** Read after mounting (again on each `reread`), none while the store cannot be read; `remove` asks as the File menu's list does, `read`: the store has answered once. */
export function useUserRecords(reread?: unknown) {
  const { i18n } = useLingui()
  const [records, setRecords] = useState<UserRecord[]>([])
  const [read, setRead] = useState(false)
  useEffect(() => {
    let live = true
    storedRecords().then(
      (r) => {
        if (!live) return
        setRecords(r.records)
        setRead(true)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [reread])
  const remove = useCallback(
    async (rowId: string, rowName: string) => {
      const id = userRecordId(rowId)
      // the record's name, as the File menu's list shows it
      const name = records.find((r) => r.id === id)?.name ?? rowName
      if (
        !id ||
        !(await confirmDialog({
          title: i18n._({
            id: 'listSources.deleteAsk',
            message: 'Delete {name} from this browser? This cannot be undone.',
            values: { name },
          }),
          confirmLabel: i18n._({ id: 'listSources.delete', message: 'Delete' }),
          danger: true,
        }))
      )
        return
      try {
        await deleteRecords([id])
      } catch {
        await confirmDialog({
          title: i18n._({
            id: 'listSources.notDeleted',
            message: '{name} was not deleted: the browser refused.',
            values: { name },
          }),
          confirmLabel: i18n._({ id: 'listSources.ok', message: 'OK' }),
        })
        return
      }
      setRecords((rs) => rs.filter((r) => r.id !== id))
    },
    [records, i18n],
  )
  return [records, remove, read] as const
}

/** The user variants resolved against the catalogue after mounting, none until then. */
export function useResolved<V>(
  records: readonly UserRecord[],
  read: (records: readonly UserRecord[]) => Promise<V[]>,
) {
  const [views, setViews] = useState<V[]>([])
  useEffect(() => {
    let live = true
    read(records).then(
      (v) => live && setViews(v),
      () => {},
    )
    return () => {
      live = false
    }
  }, [records, read])
  return views
}

/** The sources that are off live in the list's URL; the last one on cannot be turned off. */
export function SourceFilter({
  src,
  counts,
  onChange,
  sources = origins,
}: {
  src: string | undefined
  counts: Record<Origin, number>
  onChange: (src: string) => void
  sources?: readonly Origin[] | undefined
}) {
  const { i18n } = useLingui()
  const shown = readOrigins(src, sources)
  const text =
    shown.length === sources.length
      ? i18n._({ id: 'listSources.all', message: 'All sources' })
      : shown.map((o) => i18n._(originNames[o])).join(', ')
  return (
    <AppPopover position="bottom-start" trapFocus>
      <Popover.Target>
        <Button
          className="source-filter"
          data-set={shown.length < sources.length || undefined}
          variant="default"
          size={controlSize.row.button}
          aria-label={i18n._({
            id: 'listSources.button',
            message: 'Source: {text}',
            values: { text },
          })}
          aria-haspopup="dialog"
          w="9rem"
          rightSection={<ChevronDown size={12} aria-hidden="true" />}
          justify="space-between"
        >
          {text}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={8}>
          {sources.map((o) => {
            const checked = shown.includes(o)
            const last = checked && shown.length === 1
            return (
              <Tooltip
                key={o}
                label={i18n._({
                  id: 'listSources.lastOn',
                  message: 'At least one source stays on',
                })}
                disabled={!last}
              >
                <Checkbox
                  checked={checked}
                  disabled={last}
                  label={
                    <Group component="span" justify="space-between" gap="md" wrap="nowrap">
                      <span>{i18n._(originNames[o])}</span>
                      <span className="source-count">{counts[o]}</span>
                    </Group>
                  }
                  onChange={() => onChange(toggleOrigin(src, o, sources))}
                />
              </Tooltip>
            )
          })}
        </Stack>
      </Popover.Dropdown>
    </AppPopover>
  )
}

/** A catalogue row is blank on screen and named for screen readers. */
export function sourceColumn<T extends { id: string; origin?: 'user' | undefined }>(
  name: (row: T) => string,
  onDelete: (rowId: string, name: string) => void,
): DirectoryColumn<T> {
  return {
    key: 'source',
    label: /*i18n*/ { id: 'listSources.column.source', message: 'Source' },
    help: /*i18n*/ {
      id: 'listSources.column.sourceHelp',
      message:
        'Mine: designs saved in this browser. Rows without a mark are the RangeFoundry catalog.',
    },
    width: '6.5rem',
    value: (r) => originOf(r),
    cell: (r, tabIndex) =>
      r.origin === 'user' ? (
        <Group component="span" display="inline-flex" gap={4} wrap="nowrap">
          <Badge variant="filled" size="sm" tt="none" className="source-badge">
            <OriginName origin="user" />
          </Badge>
          <DeleteRow row={r} name={name(r)} onDelete={onDelete} tabIndex={tabIndex} />
        </Group>
      ) : (
        <span className="visually-hidden">
          <OriginName origin="rangefoundry" />
        </span>
      ),
  }
}

/** The name of a source in the language shown. */
function OriginName({ origin }: { origin: Origin }) {
  const { i18n } = useLingui()
  return i18n._(originNames[origin])
}

/** A Mine row's Delete: in the Source column, and on a phone (where that column is hidden) at the row's end. */
export function DeleteRow({
  row,
  name,
  onDelete,
  tabIndex,
}: {
  row: { id: string }
  name: string
  onDelete: (rowId: string, name: string) => void
  tabIndex: number
}) {
  const { i18n } = useLingui()
  return (
    <Tooltip label={i18n._({ id: 'listSources.deleteRow', message: 'Delete from this browser' })}>
      <ActionIcon
        className="row-action"
        tabIndex={tabIndex}
        variant="subtle"
        color="red"
        size={controlSize.row.icon}
        aria-label={i18n._({
          id: 'listSources.deleteName',
          message: 'Delete {name}',
          values: { name },
        })}
        onClick={() => onDelete(row.id, name)}
      >
        <Trash size={14} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
