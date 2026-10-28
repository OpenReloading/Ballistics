'use client'

import { ActionIcon, Badge, Button, Checkbox, Group, Popover, Stack, Tooltip } from '@mantine/core'
import type { UserRecord } from '@open-reloading/schema'
import { CaretDown, Trash } from '@phosphor-icons/react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
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
import { deleteRecords, storedRecords } from '../lib/user-store.ts'
import { AppPopover } from './app-popover.tsx'
import { confirmDialog } from './confirm.tsx'
import type { DirectoryColumn } from './directory-table.tsx'

/**
 * The user records of this browser, read after mounting; none while the store cannot be
 * read (again whenever `reread` changes). `remove` asks, as the File menu's list of browser records does, then deletes the record of
 * a list row and drops the row.
 */
export function useUserRecords(reread?: unknown) {
  const { t } = useTranslation()
  const [records, setRecords] = useState<UserRecord[]>([])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reread` only restarts the read
  useEffect(() => {
    let live = true
    storedRecords().then(
      (r) => live && setRecords(r.records),
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
          title: t('Delete {name} from this browser? This cannot be undone.', { name }),
          confirmLabel: t('Delete'),
          danger: true,
        }))
      )
        return
      try {
        await deleteRecords([id])
      } catch {
        await confirmDialog({
          title: t('{name} was not deleted: the browser refused.', { name }),
          confirmLabel: t('OK'),
        })
        return
      }
      setRecords((rs) => rs.filter((r) => r.id !== id))
    },
    [records, t],
  )
  return [records, remove] as const
}

/**
 * `records` read into views by `read` (`userBullets`, `userCartridges`): the user variants resolved
 * against the catalogue after mounting, none until then.
 */
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

/**
 * The data source filter of every list: a button naming the sources shown, and a popover with one
 * checkbox per source of the list (`sources`) with its row count. The sources that are off are kept
 * in the URL by the list. The last one on cannot be turned off.
 */
export function SourceFilter({
  src,
  counts,
  onChange,
  sources = origins,
}: {
  src: string | undefined
  counts: Record<Origin, number>
  onChange: (src: string) => void
  sources?: readonly Origin[]
}) {
  const { t } = useTranslation()
  const shown = readOrigins(src, sources)
  const text =
    shown.length === sources.length
      ? t('All sources')
      : shown.map((o) => t(originNames[o])).join(', ')
  return (
    <AppPopover position="bottom-start" trapFocus>
      <Popover.Target>
        <Button
          className="source-filter"
          data-set={shown.length < sources.length || undefined}
          variant="default"
          size={controlSize.row.button}
          aria-label={t('Source: {text}', { text })}
          aria-haspopup="dialog"
          w="9rem"
          rightSection={<CaretDown size={12} aria-hidden="true" />}
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
              <Tooltip key={o} label={t('At least one source stays on')} disabled={!last}>
                <Checkbox
                  checked={checked}
                  disabled={last}
                  label={
                    <Group component="span" justify="space-between" gap="md" wrap="nowrap">
                      <span>{t(originNames[o])}</span>
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

/**
 * The Source column of the bullet and cartridge lists: a Mine row's badge and Delete. A catalogue
 * row is blank on screen and named for screen readers.
 */
export function sourceColumn<T extends { id: string; origin?: 'user' | undefined }>(
  name: (row: T) => string,
  onDelete: (rowId: string, name: string) => void,
): DirectoryColumn<T> {
  return {
    key: 'source',
    label: msg('Source'),
    help: msg(
      'Mine: designs saved in this browser. Rows without a mark are the OpenReloading catalog.',
    ),
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
          <OriginName origin="openreloading" />
        </span>
      ),
  }
}

/** The name of a source in the language shown. */
function OriginName({ origin }: { origin: Origin }) {
  const { t } = useTranslation()
  return t(originNames[origin])
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
  const { t } = useTranslation()
  return (
    <Tooltip label={t('Delete from this browser')}>
      <ActionIcon
        className="row-action"
        tabIndex={tabIndex}
        variant="subtle"
        color="red"
        size={controlSize.row.icon}
        aria-label={t('Delete {name}', { name })}
        onClick={() => onDelete(row.id, name)}
      >
        <Trash size={14} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
