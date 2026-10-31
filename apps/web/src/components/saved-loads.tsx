'use client'

import { ActionIcon, Button, Drawer, Text, TextInput } from '@mantine/core'
import { parseRef } from '@open-reloading/schema'
import { Copy, DownloadSimple, PencilSimple, Printer, Trash } from '@phosphor-icons/react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { fixedNumber } from '../i18n/number.ts'
import type { Say } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { dateTimeText } from '../lib/dates.ts'
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
import { loadGapNote, loadGaps } from '../lib/load-gaps.ts'
import {
  cartridgeGroup,
  duplicateStored,
  type LoadRecord,
  loadGroups,
  renameStored,
} from '../lib/load-tabs.ts'
import { type LoadUse, loadUse, loadUseText } from '../lib/load-use.ts'
import { newId } from '../lib/new-id.ts'
import { shortcutLabel } from '../lib/shortcuts.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { userDataText } from '../lib/user-data.ts'
import { recordFileName } from '../lib/user-file-names.ts'
import { deleteRecord, storedRecord, storedRecords } from '../lib/user-store.ts'
import { confirmDialog } from './confirm.tsx'

/** Saves since the last export (`localStorage` `exportReminder`), counted by the File menu's callbacks. */
export function useExportReminder() {
  // the text is set in effects and handlers: a date read while rendering is not prerendered
  const { t, tn } = useTranslation()
  const [due, setDue] = useState<{ reminder: ExportReminder; now: Date }>()
  const text = due && reminderText(due.reminder, due.now, t, tn)
  useEffect(() => {
    try {
      setDue({ reminder: parseReminder(localStorage.getItem(reminderKey)), now: new Date() })
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
    setDue({ reminder: value, now: new Date() })
  }, [])
  return {
    text,
    changed: useCallback(() => store((r) => afterChange(r, new Date())), [store]),
    exported: useCallback(() => store(() => afterExport(new Date())), [store]),
  }
}

/** Whether the browser keeps the records, and how much storage they use. */
function useStorage(opened: boolean) {
  const [info, setInfo] = useState<{ persisted?: boolean | undefined; used?: number | undefined }>(
    {},
  )
  useEffect(() => {
    if (!opened) return
    const s = navigator.storage
    void Promise.all([
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
    void Promise.all(
      wanted.split(',').map(async (id) => {
        // a design is a record of this browser, a catalogue cartridge one of the API
        const own = parseRef(id)?.scope === 'user' ? parseRef(id)?.id : undefined
        const record = own
          ? await storedRecord(own).catch(() => undefined)
          : await fetchRecord<{ name?: string | undefined }>('cartridges', id).catch(
              () => undefined,
            )
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
  bytes < 1e5
    ? `${fixedNumber(Math.max(1, Math.round(bytes / 1e3)), 0)} kB`
    : `${fixedNumber(bytes / 1e6, 1)} MB`

/** The field that replaces the button that was pressed takes the focus the button had. */
const focusField = (field: HTMLInputElement | null) => field?.focus()

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
  system,
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
  reminder?: string | undefined
  /** The units the box label prints in. */
  system: UnitSystem
}) {
  const [records, setRecords] = useState<LoadRecord[]>([])
  /** The store has answered once: until then no empty state. */
  const [read, setRead] = useState(false)
  const [query, setQuery] = useState('')
  const { t, tn } = useTranslation()
  /** The line under the list, written in the language shown. */
  const [shown, setShown] = useState<{ say: Say }>()
  const setMessage = (say?: Say) => setShown(say && { say })
  /** Stored loads of the earlier format, which the schema refuses. */
  const [older, setOlder] = useState(0)
  /** Per load its firearm, sessions, last session day and gap; the stored firearms' names by id. */
  const [use, setUse] = useState({
    loads: new Map<string, LoadUse>(),
    firearms: new Map<string, string>(),
    gaps: loadGaps([]).loads,
  })
  /** The load whose name is edited in its row, with the text. */
  const [renaming, setRenaming] = useState<{ id: string; text: string }>()
  const storage = useStorage(opened)
  /** The box label being printed, a portal of `body`. */
  const [label, setLabel] = useState<ReactNode>()
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` is the write counter
  useEffect(() => {
    if (!opened) return
    storedRecords()
      .then(({ records, invalid }) => {
        setRecords(records.filter((r): r is LoadRecord => r.kind === 'load'))
        setRead(true)
        setOlder(invalid.filter((i) => i.kind === 'workbenchState').length)
        setUse({
          loads: loadUse(records).loads,
          firearms: new Map(
            records.flatMap((r) => (r.kind === 'firearm' ? [[r.id, r.name] as const] : [])),
          ),
          gaps: loadGaps(records).loads,
        })
      })
      .catch(() =>
        setShown({ say: (t) => t('The saved loads could not be read from this browser.') }),
      )
  }, [opened, tick])

  async function exportOne(r: LoadRecord) {
    setMessage()
    try {
      const done = await saveAs(userDataText([r]), recordFileName(r.name))
      if (done)
        setMessage((t) => t('Exported {name} to {file}.', { name: r.name, file: done.name }))
    } catch (e) {
      setMessage((t) => t('Export failed: {error}', { error: errorText(e) }))
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
    setMessage()
    try {
      await renameStored(r.id, name)
      onRenamed(r.id, name)
      onStored()
    } catch (e) {
      setMessage((t) => t('Rename failed: {error}', { error: errorText(e) }))
    }
  }

  async function duplicate(r: LoadRecord) {
    setMessage()
    try {
      await duplicateStored(r, newId())
      onStored()
    } catch (e) {
      setMessage((t) => t('Copy failed: {error}', { error: errorText(e) }))
    }
  }

  async function remove(r: LoadRecord) {
    if (
      !(await confirmDialog({
        title: t('Delete {name} from this browser? This cannot be undone.', { name: r.name }),
        confirmLabel: t('Delete'),
        danger: true,
      }))
    )
      return
    setMessage()
    try {
      await deleteRecord(r.id)
    } catch (e) {
      setMessage((t) => t('Delete failed: {error}', { error: errorText(e) }))
      return
    }
    setRecords((rs) => rs.filter((x) => x.id !== r.id))
    onDeleted(r.id)
  }

  const names = useCartridgeNames([
    ...new Set(
      [
        ...records.map((r) => r.data.cartridge),
        ...[...use.gaps.values()].map((g) => (g.kind === 'mismatch' ? g.own : undefined)),
      ].map(cartridgeGroup),
    ),
  ])
  const groups = loadGroups(records, query, names, t)
  const usageText = (id: string) => {
    const u = use.loads.get(id)
    const firearm = u?.firearm && use.firearms.get(u.firearm)
    const note = loadGapNote(use.gaps.get(id), firearm, (ref) => names[cartridgeGroup(ref)], t)
    return [loadUseText(u, firearm, { t, tn }), note].filter(Boolean).join(' · ')
  }
  return (
    <>
      {label}
      <Drawer.Root opened={opened} onClose={onClose} size="sm" position="left">
        <Drawer.Overlay />
        <Drawer.Content>
          {/* a div: a second <header> beside the site header would be another banner landmark */}
          <Drawer.Header component="div">
            <Drawer.Title>{t('Saved loads')}</Drawer.Title>
            <Drawer.CloseButton aria-label={t('Close saved loads')} />
          </Drawer.Header>
          <Drawer.Body>
            <TextInput
              aria-label={t('Search saved loads')}
              placeholder={t('Name or lot')}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              disabled={records.length === 0}
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
                            aria-label={t('Name of {name}', { name: r.name })}
                            maxLength={200}
                            ref={focusField}
                            value={renaming.text}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setRenaming({ id: r.id, text: e.currentTarget.value })}
                            onBlur={(e) => rename(r, e.currentTarget.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void rename(r, renaming.text)
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
                        <span className="file-reason saved-use">{usageText(r.id)}</span>
                        <span className="file-reason">{dateTimeText(new Date(r.saved))}</span>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          aria-label={t('Rename {name}', { name: r.name })}
                          title={t('Rename')}
                          onClick={() => edit(r.id, r.name)}
                        >
                          <PencilSimple size={16} aria-hidden="true" />
                        </ActionIcon>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          aria-label={t('Duplicate {name}', { name: r.name })}
                          title={t('Duplicate')}
                          onClick={() => duplicate(r)}
                        >
                          <Copy size={16} aria-hidden="true" />
                        </ActionIcon>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          aria-label={t('Export {name}', { name: r.name })}
                          title={t('Export to a file')}
                          onClick={() => exportOne(r)}
                        >
                          <DownloadSimple size={16} aria-hidden="true" />
                        </ActionIcon>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          aria-label={t('Print a box label of {name}', { name: r.name })}
                          title={t('Print a box label')}
                          onClick={() =>
                            // a plain import(): the label and its QR code stay out of the workbench's weight
                            import('./box-label.tsx')
                              .then((m) => m.printBoxLabel(r, system, t, setLabel))
                              .catch((e) =>
                                setMessage((t) =>
                                  t('Print failed: {error}', { error: errorText(e) }),
                                ),
                              )
                          }
                        >
                          <Printer size={16} aria-hidden="true" />
                        </ActionIcon>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          color="red"
                          aria-label={t('Delete {name}', { name: r.name })}
                          title={t('Delete')}
                          onClick={() => remove(r)}
                        >
                          <Trash size={16} aria-hidden="true" />
                        </ActionIcon>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {read && groups.length === 0 && (
                <Text size="sm" c="dimmed">
                  {records.length === 0
                    ? t(
                        'No saved loads yet. Save a load on the workbench with Save or {keys}, and it appears here.',
                        { keys: shortcutLabel('save') },
                      )
                    : t('No match.')}
                </Text>
              )}
            </div>
            <Button
              variant="default"
              size={controlSize.row.button}
              disabled={records.length === 0}
              onClick={() =>
                // a plain import(): the CSV code stays out of the workbench's weight
                import('../lib/records-csv.ts')
                  .then((m) => m.saveLoadsCsv())
                  .catch((e) =>
                    setMessage((t) => t('Export failed: {error}', { error: errorText(e) })),
                  )
              }
            >
              {t('Export CSV')}
            </Button>
            <div className="saved-storage" role="status">
              {shown && <p>{shown.say(t)}</p>}
              {older > 0 && (
                <p>
                  {tn(
                    older,
                    '{count} saved load is in the format of an earlier version, which this app no longer reads. Open lists it under Invalid records.',
                    '{count} saved loads are in the format of an earlier version, which this app no longer reads. Open lists them under Invalid records.',
                  )}
                </p>
              )}
              {storage.persisted !== undefined && (
                <p>
                  {storage.persisted
                    ? t('Persistent storage: granted.')
                    : t('Persistent storage: not granted, the browser may clear the saved loads.')}
                </p>
              )}
              {storage.used !== undefined && (
                <p>{t('Storage used: {size}.', { size: megabytes(storage.used) })}</p>
              )}
              {reminder && (
                <p data-due>
                  {t('{reminder} Export all (Save options) keeps a copy.', { reminder })}
                </p>
              )}
            </div>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  )
}
