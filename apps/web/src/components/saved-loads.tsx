'use client'

import { ActionIcon, Button, Drawer, Text, TextInput } from '@mantine/core'
import { Copy, DownloadSimple, PencilSimple, Trash } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import { errorText } from '../lib/error-text.ts'
import {
  afterChange,
  afterExport,
  type ExportReminder,
  parseReminder,
  reminderKey,
  reminderText,
} from '../lib/export-reminder.ts'
import { saveAs } from '../lib/file-access.ts'
import { duplicateStored, type LoadRecord, loadGroups, renameStored } from '../lib/load-tabs.ts'
import { newId } from '../lib/new-id.ts'
import { controlSize } from '../lib/theme.ts'
import { userDataText } from '../lib/user-data.ts'
import { recordFileName } from '../lib/user-file-names.ts'
import { deleteRecord, storedRecords } from '../lib/user-store.ts'
import { confirmDialog } from './confirm.tsx'

/** Saves since the last export (`localStorage` `exportReminder`), counted by the File menu's callbacks. */
export function useExportReminder() {
  // the text is set in effects and handlers: a date read while rendering is not prerendered
  const [text, setText] = useState<string>()
  useEffect(() => {
    try {
      setText(reminderText(parseReminder(localStorage.getItem(reminderKey)), new Date()))
    } catch {}
  }, [])
  const store = useCallback((next: (r: ExportReminder) => ExportReminder) => {
    let current: ExportReminder = { changes: 0 }
    try {
      current = parseReminder(localStorage.getItem(reminderKey))
    } catch {}
    const value = next(current)
    try {
      localStorage.setItem(reminderKey, JSON.stringify(value))
    } catch {}
    setText(reminderText(value, new Date()))
  }, [])
  return {
    text,
    changed: useCallback(() => store((r) => afterChange(r, new Date())), [store]),
    exported: useCallback(() => store(() => afterExport(new Date())), [store]),
  }
}

/** Whether the browser keeps the records, and how much storage they use. */
function useStorage(opened: boolean) {
  const [info, setInfo] = useState<{ persisted?: boolean; used?: number }>({})
  useEffect(() => {
    if (!opened) return
    const s = navigator.storage
    Promise.all([
      s?.persisted?.().catch(() => undefined),
      s
        ?.estimate?.()
        .then((e) => e.usage)
        .catch(() => undefined),
    ]).then(([persisted, used]) => setInfo({ persisted, used }))
  }, [opened])
  return info
}

/** Names of the cartridges the loads refer to, by id; asked once per id, a cartridge the API lacks stays out. */
const cartridgeNames = new Map<string, string>()

function useCartridgeNames(ids: string[]) {
  const [, setCount] = useState(0)
  const wanted = ids.filter((id) => id && !cartridgeNames.has(id)).join(',')
  useEffect(() => {
    if (!wanted) return
    let alive = true
    Promise.all(
      wanted.split(',').map(async (id) => {
        const record = await fetchRecord<{ name?: string }>('cartridges', id).catch(() => undefined)
        const name = record?.name
        if (name) cartridgeNames.set(id, name)
      }),
    ).then(() => alive && setCount((n) => n + 1))
    return () => {
      alive = false
    }
  }, [wanted])
  return Object.fromEntries(cartridgeNames)
}

const megabytes = (bytes: number) =>
  bytes < 1e5 ? `${Math.max(1, Math.round(bytes / 1e3))} kB` : `${(bytes / 1e6).toFixed(1)} MB`

/**
 * The saved loads of the browser store: search, grouped by cartridge; a row opens the load in
 * a tab, renames it, duplicates it, exports it to a file or deletes it. States whether the browser keeps the records and the
 * reminder to export.
 */
export function SavedLoads({
  opened,
  onClose,
  tick,
  openIds,
  onOpen,
  onDeleted,
  onRenamed,
  onStored,
  reminder,
}: {
  opened: boolean
  onClose: () => void
  /** Counts the writes to the store, so the list reads it again. */
  tick: number
  /** Ids of the loads open in tabs. */
  openIds: string[]
  onOpen: (record: LoadRecord) => void
  onDeleted: (id: string) => void
  /** A load was renamed in the store: the tab that holds it takes the name. */
  onRenamed: (id: string, name: string) => void
  /** Called after a rename or a copy wrote the store. */
  onStored: () => void
  reminder?: string
}) {
  const [records, setRecords] = useState<LoadRecord[]>([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  /** The load whose name is edited in its row, with the text. */
  const [renaming, setRenaming] = useState<{ id: string; text: string }>()
  const storage = useStorage(opened)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is the write counter
  useEffect(() => {
    if (!opened) return
    storedRecords()
      .then(({ records }) =>
        setRecords(records.filter((r): r is LoadRecord => r.kind === 'workbenchState')),
      )
      .catch(() => setMessage('The saved loads could not be read from this browser.'))
  }, [opened, tick])

  async function exportOne(r: LoadRecord) {
    setMessage('')
    try {
      const done = await saveAs(userDataText([r]), recordFileName(r.name))
      if (done) setMessage(`Exported ${r.name} to ${done.name}.`)
    } catch (e) {
      setMessage(`Export failed: ${errorText(e)}`)
    }
  }

  /** Whether a name is being edited: the field removed by Enter blurs once more. */
  const editing = useRef(false)
  const edit = (id: string, text: string) => {
    editing.current = true
    setRenaming({ id, text })
  }
  const stopEdit = () => {
    editing.current = false
    setRenaming(undefined)
  }

  async function rename(r: LoadRecord, text: string) {
    if (!editing.current) return
    stopEdit()
    const name = text.trim()
    if (!name || name === r.name) return
    setMessage('')
    try {
      await renameStored(r.id, name)
      onRenamed(r.id, name)
      onStored()
    } catch (e) {
      setMessage(`Rename failed: ${errorText(e)}`)
    }
  }

  async function duplicate(r: LoadRecord) {
    setMessage('')
    try {
      await duplicateStored(r, newId())
      onStored()
    } catch (e) {
      setMessage(`Copy failed: ${errorText(e)}`)
    }
  }

  async function remove(r: LoadRecord) {
    if (
      !(await confirmDialog({
        title: `Delete ${r.name} from this browser? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    setMessage('')
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setMessage(`Delete failed: ${errorText(e)}`)
      return
    }
    setRecords((rs) => rs.filter((x) => x.id !== r.id))
    onDeleted(r.id)
  }

  const names = useCartridgeNames([...new Set(records.map((r) => r.data.cartridge ?? ''))])
  const groups = loadGroups(records, query, names)
  return (
    <Drawer opened={opened} onClose={onClose} title="Saved loads" size="sm" position="left">
      <TextInput
        aria-label="Search saved loads"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        mb="sm"
      />
      <div className="saved-loads">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.title}>
            <Text fw={600} size="sm">
              {g.title}
            </Text>
            <ul>
              {g.records.map((r) => (
                <li key={r.id}>
                  {renaming?.id === r.id ? (
                    <input
                      className="saved-rename"
                      aria-label={`Name of ${r.name}`}
                      maxLength={200}
                      // biome-ignore lint/a11y/noAutofocus: the field replaces the button that was pressed
                      autoFocus
                      value={renaming.text}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setRenaming({ id: r.id, text: e.currentTarget.value })}
                      onBlur={(e) => rename(r, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rename(r, renaming.text)
                        else if (e.key === 'Escape') {
                          // the drawer stays open
                          e.stopPropagation()
                          stopEdit()
                        }
                      }}
                    />
                  ) : (
                    <Button
                      variant="subtle"
                      size={controlSize.row.button}
                      className="saved-open"
                      aria-current={openIds.includes(r.id) || undefined}
                      onClick={() => {
                        onOpen(r)
                        onClose()
                      }}
                    >
                      {r.name}
                    </Button>
                  )}
                  <span className="file-reason">{new Date(r.saved).toLocaleString()}</span>
                  <ActionIcon
                    size={controlSize.row.icon}
                    variant="subtle"
                    aria-label={`Rename ${r.name}`}
                    title="Rename"
                    onClick={() => edit(r.id, r.name)}
                  >
                    <PencilSimple size={16} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon
                    size={controlSize.row.icon}
                    variant="subtle"
                    aria-label={`Duplicate ${r.name}`}
                    title="Duplicate"
                    onClick={() => duplicate(r)}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon
                    size={controlSize.row.icon}
                    variant="subtle"
                    aria-label={`Export ${r.name}`}
                    title="Export to a file"
                    onClick={() => exportOne(r)}
                  >
                    <DownloadSimple size={16} aria-hidden="true" />
                  </ActionIcon>
                  <ActionIcon
                    size={controlSize.row.icon}
                    variant="subtle"
                    color="red"
                    aria-label={`Delete ${r.name}`}
                    title="Delete"
                    onClick={() => remove(r)}
                  >
                    <Trash size={16} aria-hidden="true" />
                  </ActionIcon>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && (
          <Text size="sm" c="dimmed">
            {records.length === 0 ? 'No saved loads.' : 'No match.'}
          </Text>
        )}
      </div>
      <div className="saved-storage" role="status">
        {message && <p>{message}</p>}
        {storage.persisted !== undefined && (
          <p>
            {storage.persisted
              ? 'Persistent storage: granted.'
              : 'Persistent storage: not granted, the browser may clear the saved loads.'}
          </p>
        )}
        {storage.used !== undefined && <p>Storage used: {megabytes(storage.used)}.</p>}
        {reminder && <p data-due>{reminder} Export all (Save options) keeps a copy.</p>}
      </div>
    </Drawer>
  )
}
