'use client'

import { Button, Group, Kbd, Menu, Textarea } from '@mantine/core'
import type { EmbeddedFile, UserRecord, UserRecordKind } from '@openreloading/schema'
import { CaretDown, FloppyDisk, FolderOpen } from '@phosphor-icons/react'
import { memo, type Ref, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { localDay } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import {
  pickFiles,
  readHandleText,
  saveAs,
  saveToFolder,
  writeHandleText,
} from '../lib/file-access.ts'
import { parseFiles, readLoadFile, readNote } from '../lib/load-file-formats.ts'
import { guardNavigation, guardPop } from '../lib/navigation-guard.ts'
import { maxLinkChars, readLink, shareLink } from '../lib/share-link.ts'
import { type ShortcutId, shortcutAriaKeys, shortcutLabel } from '../lib/shortcuts.ts'
import { controlSize } from '../lib/theme.ts'
import {
  canonicalJson,
  checkedUserDataText,
  exportAllText,
  type InvalidRecord,
  maxFileBytes,
  namedKey,
  type ParsedUserFile,
  parseUserDataFile,
  planImport,
  renamedKey,
  tooLargeMessage,
  userDataText,
} from '../lib/user-data.ts'
import { ownsFile, recordFileName } from '../lib/user-file-names.ts'
import { droppedPhotos, embeddedFileBlob, embedFiles, photoIds } from '../lib/user-photos.ts'
import {
  deletePhoto,
  deleteRecords,
  putPhoto,
  putRecords,
  requestPersistentStorage,
  storedPhoto,
  storedPhotoIds,
  storedRecord,
  storedRecords,
} from '../lib/user-store.ts'
import {
  canPickFolder,
  chooseFolder,
  folderAllowed,
  forgetFolder,
  restoreFolder,
} from '../lib/workspace-folder.ts'
import { AppModal } from './app-modal.tsx'
import { confirmDialog } from './confirm.tsx'
import { BarStatus } from './page-bar.tsx'
import { useReportOptions } from './report-host.ts'
import { useShortcuts } from './shortcuts.tsx'

/** A question that drops what the page holds, answered in the app's confirm dialog. */
const ask = (title: string, confirmLabel: string) =>
  confirmDialog({ title, confirmLabel, danger: true })

type Of<K extends UserRecordKind> = Extract<UserRecord, { kind: K }>

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** A file's text; undefined for a file over the size limit, which is not read. */
const read = async (file: File) => (file.size > maxFileBytes ? undefined : file.text())

/** A menu item's shortcut, shown at its right and named to screen readers. */
const keyed = (id: ShortcutId) => ({
  'aria-keyshortcuts': shortcutAriaKeys(id),
  rightSection: (
    <Kbd size="xs" aria-hidden="true">
      {shortcutLabel(id)}
    </Kbd>
  ),
})

const kindNames: Record<UserRecordKind, string> = {
  bulletDesign: 'bullet designs',
  cartridgeDesign: 'cartridge designs',
  workbenchState: 'loads',
  firearm: 'firearms',
  targetSheet: 'target sheets',
  targetFaceDesign: 'target face designs',
}

/** Kinds a share link carries: the designs and the workbench load. */
const shareable: UserRecordKind[] = ['bulletDesign', 'cartridgeDesign', 'workbenchState']

const parentOf = (r: UserRecord) =>
  r.kind === 'bulletDesign' || r.kind === 'cartridgeDesign' ? r.data.parent : undefined

/**
 * What the menu holds about the record shown (its id, kept file and saved text), so a page with
 * several records open (the workbench tabs) puts it back when it shows that record again.
 */
export interface FileState {
  id?: string
  handle?: FileSystemFileHandle
  known?: string
  saved?: { file: string; json: string }
  /** The record's start text; undefined takes the data of the next render. */
  initial?: string
  /** Unsaved changes when the state was taken. */
  unsaved: boolean
}

/** What a page calls before it starts a new record (New, Reset, Example, a catalogue start). */
export interface FileMenuHandle {
  /**
   * Asks before dropping unsaved changes (edits since the record was opened, saved or started);
   * on yes the menu starts a new record: a new id, no file, not saved. False when the user keeps
   * the changes, and the page then does nothing. `next` is the new record's data when the page
   * knows it (a page with deferred data must pass it); else the data of the render after `then`,
   * the page's own change, which runs on yes before that render (when `then` returns a promise,
   * the render after it settles). The answer is a promise only when
   * the dialog asks.
   */
  startNew(next?: unknown, then?: () => unknown): true | Promise<boolean>
  /** Opens a browser record as the Open menu's saved records do; false when the user keeps the changes. */
  open(record: UserRecord): Promise<boolean>
  /** The id of the record shown, undefined until it is saved or opened. */
  id(): string | undefined
  /** Saves the record as the menu's Save does. */
  save(): void
  /** Opens a file as the menu's "Open file" does. */
  openFile(): void
  /** The state of the record shown. */
  snapshot(): FileState
  /** Shows `state` as the record's state, with no question; the page fills the data itself. */
  restore(state: FileState): void
  /** With `nameKey`: the saved copy was renamed (the browser record), so the new name is not a change. */
  rename(name: string): void
}

/** An item a page adds to the Open menu. */
type FileMenuItem = { label: string; run: () => void }

type Report = {
  added: number
  equal: number
  skipped: { name: string; reason: string }[]
  /** Warnings and fields not read of the files read. */
  notes: { name: string; note: string }[]
  conflicts: { incoming: UserRecord; stored: UserRecord }[]
  /** Photos the files carry, stored with the records that are replaced. */
  files: EmbeddedFile[]
}

/** The photos `records` point at, as file entries; the ones not in this browser are left out. */
async function photosOf(records: UserRecord[]) {
  const blobs = await Promise.all(
    photoIds(records).map(async (id) => ({
      id,
      blob: await storedPhoto(id).catch(() => undefined),
    })),
  )
  return embedFiles(blobs.filter((b): b is { id: string; blob: Blob } => b.blob !== undefined))
}

/** Keeps in this browser the photos of `records` that the file carries. */
async function storePhotos(files: EmbeddedFile[], records: UserRecord[]) {
  const wanted = new Set(photoIds(records))
  for (const f of files) if (wanted.has(f.id)) await putPhoto(f.id, embeddedFileBlob(f))
}

/**
 * The page bar's Open menu (the browser's records, a file, Import, Paste JSON, the page's examples)
 * and Save with its menu (Save as, share link, JSON, Export all, the optional workspace folder).
 * The same in every edition.
 */
function FileMenuOf<K extends UserRecordKind>({
  kind,
  name,
  data,
  onOpen,
  note,
  problem,
  nameKey,
  onStored,
  store,
  onExported,
  onUnsaved,
  autosaved,
  kept,
  idle,
  onList,
  examples,
  reportBox,
  ref,
}: {
  kind: K
  /** The record's name, also the suggested file name. */
  name: string
  /** The page's current record data. */
  data: Of<K>['data']
  /** `record` is the opened or saved-as record (its id and saved time). */
  onOpen: (data: Of<K>['data'], name: string, record: Of<K>) => void
  /** A line about the record the page adds to the menu's status, such as ids not loaded. */
  note?: string
  /** Why the record cannot be saved, in the page's words; Save then writes nothing. */
  problem?: string
  /**
   * The name as far as it counts as a change (the workbench): what the user typed, empty for
   * a generated name that follows the data. Renaming then is an unsaved change.
   */
  nameKey?: string
  /** Called after Save, Import or Replace wrote records to the browser store. */
  onStored?: () => void
  /**
   * Writes Save's browser copy in place of a plain put (an autosaved record written only over the
   * version the page read); false when the page kept it otherwise.
   */
  store?: (record: Of<K>) => Promise<boolean>
  /** Called after Export all wrote a file. */
  onExported?: () => void
  /** Called with whether the record has unsaved changes, when that changes. */
  onUnsaved?: (unsaved: boolean) => void
  /**
   * The id of a record the page keeps in the browser on every change (`/groups`): no leave
   * questions, Save writes this id, Open keeps the opened record in the browser, Save as writes a
   * copy with a new id that `onOpen` shows. The page lists its records itself.
   */
  autosaved?: string
  /**
   * With `autosaved`, the browser copy: `blank` before the first save (no state shown), `saving`
   * while the last change is not yet in the browser, `failed` when the browser store refused it.
   */
  kept?: 'blank' | 'saving' | 'saved' | 'failed'
  /** No record is open (the firearm library before New or Open): the status shows messages only. */
  idle?: boolean
  /** Opens the page's own list of browser records (the workbench's Saved loads) in place of the menu's. */
  onList?: () => void
  /** The Open menu's Examples section: the page's starting points. Stable, so the memo holds. */
  examples?: FileMenuItem[]
  /** The label of the Report issue box that adds the record's share link (the designers). */
  reportBox?: string
  ref?: Ref<FileMenuHandle>
}) {
  const id = useRef<string | undefined>(undefined)
  const handle = useRef<FileSystemFileHandle | undefined>(undefined)
  /** The record's saved time as this tab last opened or saved it. */
  const known = useRef<string | undefined>(undefined)
  const [saved, setSaved] = useState<{ file: string; json: string }>()
  const [message, setMessage] = useState('')
  /** A failure, announced as an alert. */
  const [failure, setFailure] = useState('')
  const [folder, setFolder] = useState<{ handle: FileSystemDirectoryHandle; allowed: boolean }>()
  const [report, setReport] = useState<Report>()
  const [list, setList] = useState<Of<K>[]>()
  /** The invalid browser records the Open menu last found, and the open list of them. */
  const [invalidCount, setInvalidCount] = useState(0)
  const [invalidList, setInvalidList] = useState<InvalidRecord[]>()
  /** Text to copy by hand where the clipboard refused it. */
  const [copyText, setCopyText] = useState<{ title: string; text: string }>()
  const [pasted, setPasted] = useState<string>()
  /** Said once the browser refuses persistent storage. */
  const [storageNote, setStorageNote] = useState('')

  // read after hydration: the server has no window
  const [folderApi, setFolderApi] = useState(false)
  useEffect(() => {
    if (!canPickFolder()) return
    setFolderApi(true)
    restoreFolder()
      .then(async (h) => {
        if (h === 'lost') setMessage('The workspace folder could not be restored; choose it again.')
        else if (h) setFolder({ handle: h, allowed: await folderAllowed(h, false) })
      })
      .catch(() => {})
  }, [])

  const named = nameKey !== undefined
  const keyOf = (d: unknown, n: string) => (named ? namedKey(d, n) : canonicalJson(d))
  const now = keyOf(data, nameKey ?? '')
  // the record as first shown or started, so edits before any save count as unsaved work;
  // undefined between startNew without `next` and the render that shows the new record
  const initial = useRef<string | undefined>(now)
  const [started, setStarted] = useState(0)
  const dirty = saved !== undefined && saved.json !== now
  // kept in the browser on every change: nothing to lose when the page goes
  const unsaved =
    !autosaved && (saved ? dirty : initial.current !== undefined && now !== initial.current)
  // Save and Open file of the menu, for a page's own commands (the workbench search)
  const commands = {
    save: () => act('Save', () => save(false))(),
    openFile: () => act('Open', open)(),
  }
  useShortcuts({
    save: commands.save,
    saveAs: () => act('Save as', () => save(true))(),
    open: commands.openFile,
  })
  const keyNow = (d: unknown) => keyOf(d, nameKey ?? '')
  const latest = useRef({ unsaved, now, saved, use, openShared, keyNow, ...commands })
  latest.current = { unsaved, now, saved, use, openShared, keyNow, ...commands }
  const unsavedCallback = useRef(onUnsaved)
  unsavedCallback.current = onUnsaved
  useEffect(() => unsavedCallback.current?.(unsaved), [unsaved])

  // a share link: the record in the fragment, validated, opened as unsaved work
  // on load, and on a link pasted into this tab (a fragment change, no reload)
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    if (!shareable.includes(kind)) return
    const read = () =>
      readLink(window.location.hash)
        .then(async (p) => {
          if (!p) return
          window.history.replaceState(window.history.state, '', window.location.href.split('#')[0])
          if (!p.ok) return setMessage(`Shared link not opened: ${p.reason}`)
          const r = p.records.find((x): x is Of<K> => x.kind === kind)
          if (!r) return setMessage(`Shared link not opened: it holds no ${kindNames[kind]}.`)
          if (
            latest.current.unsaved &&
            !(await ask('Replace the unsaved changes with the shared record?', 'Replace'))
          )
            return
          latest.current.openShared(r)
        })
        .catch(() => {})
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per startNew
  useEffect(() => {
    if (initial.current === undefined) initial.current = latest.current.now
  }, [started])

  // another record shown by the page: its file is not the one kept for Save
  useEffect(() => {
    if (!autosaved || id.current === autosaved) return
    id.current = autosaved
    handle.current = undefined
    known.current = undefined
    setSaved(undefined)
  }, [autosaved])

  useImperativeHandle(
    ref,
    () => ({
      startNew(next?: unknown, then?: () => unknown) {
        const start = () => {
          id.current = undefined
          handle.current = undefined
          known.current = undefined
          setSaved(undefined)
          initial.current = next === undefined ? undefined : latest.current.keyNow(next)
          const filling = then?.()
          const snapshot = () => setStarted((n) => n + 1)
          // a `then` that returns a promise (records still loading) is snapshot once it settles
          if (next === undefined) {
            if (filling instanceof Promise) filling.finally(snapshot)
            else snapshot()
          }
          return true as const
        }
        if (!latest.current.unsaved) return start()
        return ask('Discard the unsaved changes and start a new record?', 'Discard').then(
          (yes) => yes && start(),
        )
      },
      open: (record) => latest.current.use(record as Of<K>, `${record.name} (browser)`),
      id: () => id.current,
      save: () => latest.current.save(),
      openFile: () => latest.current.openFile(),
      snapshot: () => ({
        id: id.current,
        handle: handle.current,
        known: known.current,
        saved: latest.current.saved,
        initial: initial.current,
        unsaved: latest.current.unsaved,
      }),
      restore(state) {
        id.current = state.id
        handle.current = state.handle
        known.current = state.known
        setSaved(state.saved)
        initial.current = state.initial
        setMessage('')
        setStarted((n) => n + 1)
      },
      rename: (to) => setSaved((s) => s && { ...s, json: renamedKey(s.json, to) }),
    }),
    [],
  )

  // unsaved work: the browser's leave-page prompt, a question before an in-app link or a router
  // push or replace, and a guard history entry with this URL, so Back and Forward ask too
  useEffect(() => {
    if (!unsaved) return
    let leaving = false
    /** The question while it shows: a second way out asked meanwhile waits for the same answer. */
    let asking: Promise<boolean> | undefined
    /** True once the user chose to leave; asked once. */
    const leave = () => {
      if (leaving) return Promise.resolve(true)
      asking ??= ask('Leave this page? Changes not saved to a file are lost.', 'Leave').then(
        (go) => {
          leaving = go
          asking = undefined
          return go
        },
      )
      return asking
    }
    /** Set while a Back taken during the question is undone by a step forward. */
    let undoing = false
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    const link = (e: MouseEvent) => {
      if (leaving) return
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement) || a.target === '_blank' || a.hasAttribute('download'))
        return
      const to = new URL(a.href)
      const here = window.location
      if (to.origin !== here.origin || (to.pathname === here.pathname && to.search === here.search))
        return
      // held while the dialog asks; on yes the same click again, which passes then
      e.preventDefault()
      e.stopPropagation()
      void leave().then((go) => go && a.click())
    }
    const guard = { ...window.history.state, fileGuard: true }
    // the guard entry replaces the forward entries (Navigation API, Chromium; elsewhere unknown)
    if ((window as { navigation?: { canGoForward: boolean } }).navigation?.canGoForward)
      setMessage('Forward is not available while changes are not saved to a file.')
    window.history.pushState(guard, '', window.location.href)
    // through guardPop: runs before the router, which must not see a move off the guard entry
    const pop = (e: PopStateEvent) => {
      e.stopImmediatePropagation()
      if (undoing) {
        undoing = false
        return
      }
      // a second Back while the first asks: undone, so the first's answer acts on its own step
      if (asking) {
        undoing = true
        window.history.go(1)
        return
      }
      void leave().then((go) => {
        if (!go) {
          window.history.pushState(guard, '', window.location.href)
          setMessage('Stayed on this page to keep the changes not saved to a file.')
          return
        }
        unpop()
        window.history.back()
      })
    }
    const unguard = guardNavigation(leave)
    const unpop = guardPop(pop)
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', link, true)
    return () => {
      unguard()
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', link, true)
      unpop()
      // saved again: the guard entry goes; a navigation away has moved past it already
      if (!leaving && window.history.state?.fileGuard) window.history.back()
    }
  }, [unsaved])

  // an autosaved record is kept in the browser until a file is written
  const state = !saved
    ? autosaved
      ? kept === 'blank'
        ? ''
        : kept === 'saving'
          ? 'Saving in this browser'
          : kept === 'failed'
            ? 'Not saved in this browser'
            : 'Saved in this browser'
      : unsaved
        ? 'Unsaved changes, not saved to a file'
        : 'Not saved to a file'
    : dirty
      ? autosaved
        ? `Changed since ${saved.file}`
        : `Unsaved changes (${saved.file})`
      : `Saved: ${saved.file}`
  const ready = folder?.allowed ? folder.handle : undefined
  // in a page bar the state and messages are its status line: one line, the whole text on hover
  const bar = useContext(BarStatus)
  const lines = [message, note, storageNote].filter(Boolean).join(' ')
  const status = (
    <span
      className="file-status"
      title={[!idle && `${state}${ready ? `, folder ${ready.name}` : ''}`, lines, failure]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className="file-state"
        data-dirty={unsaved || (autosaved && kept === 'failed') || undefined}
        // also after a file is written, when the text is the file's state
        data-saving={(autosaved && kept === 'saving') || undefined}
        aria-live="polite"
      >
        {!idle && state}
        {!idle && ready && `, folder ${ready.name}`}
      </span>
      <span role="status" className="file-message">
        {lines}
      </span>
      <span role="alert" className="file-message">
        {failure}
      </span>
    </span>
  )

  /** Runs a file action; a failure is shown, not thrown. */
  const act = (what: string, f: () => Promise<void>) => () => {
    setMessage('')
    setFailure('')
    f().catch((e: unknown) => setFailure(`${what} failed: ${errorText(e)}`))
  }

  async function save(as: boolean) {
    if (problem) {
      setFailure(`Not saved: ${problem}`)
      return
    }
    const recordId = as || !id.current ? newId() : id.current
    const record = { kind, id: recordId, name, saved: new Date().toISOString(), data } as Of<K>
    // a file Open and Import would reject is not written
    const checked = checkedUserDataText([record], await photosOf([record]))
    if (!checked.ok) {
      setFailure(`Not saved: ${checked.reason}`)
      return
    }
    const { text } = checked
    // a copy saved after this tab's one (another tab or window) is overwritten only on yes
    const savedIn = (t: string | undefined) => {
      const p = t === undefined ? undefined : parseUserDataFile(t)
      return p?.ok ? p.records.find((r) => r.id === recordId)?.saved : undefined
    }
    let agreed = false
    const allow = async (other: string | undefined) => {
      if (agreed || !known.current || !other || other <= known.current) return true
      agreed = await confirmDialog({
        title: 'Overwrite the newer copy?',
        message: `A newer copy of this record was saved at ${new Date(other).toLocaleString()} (another tab or window); this tab has the copy saved at ${new Date(known.current).toLocaleString()}.`,
        confirmLabel: 'Overwrite',
        danger: true,
      })
      return agreed
    }
    const keepNewer = () => setMessage('Not saved: a newer copy was kept.')
    // a failed read leaves the check to the file; the write reports the browser store failure; an
    // autosaved record's browser copy is this page's own
    if (
      !as &&
      !autosaved &&
      !(await allow((await storedRecord(recordId).catch(() => undefined))?.saved))
    )
      return keepNewer()
    let file: string
    const current = !as && handle.current ? await readHandleText(handle.current) : undefined
    // a kept file is written only while it holds this record alone (not an Export all file)
    if (handle.current && ownsFile(current, recordId)) {
      if (!(await allow(savedIn(current)))) return keepNewer()
      await writeHandleText(handle.current, text)
      file = handle.current.name
    } else if (!as && ready) {
      const h = await saveToFolder(ready, recordFileName(name), recordId, text, (t) =>
        allow(savedIn(t)),
      )
      if (!h) return keepNewer()
      handle.current = h
      file = h.name
    } else {
      const r = await saveAs(text, recordFileName(name), ready)
      if (!r) return
      handle.current = r.handle
      file = r.name
    }
    id.current = recordId
    known.current = record.saved
    try {
      if (!store) await putRecords([record])
      if (!store || (await store(record))) onStored?.()
      noteStorage()
    } catch (e) {
      setFailure(`Saved to ${file}; the browser copy failed: ${errorText(e)}`)
    }
    // the file holds the record whether or not the browser copy was written
    setSaved({ file, json: keyOf(data, nameKey ?? '') })
    // the copy is what the page shows now
    if (autosaved && as) onOpen(data, name, record)
  }

  /** A shared record: a new id, no file, unsaved until saved. */
  function openShared(record: Of<K>) {
    onOpen(record.data as Of<K>['data'], record.name, record)
    id.current = undefined
    handle.current = undefined
    known.current = undefined
    setSaved(undefined)
    // not the canonical text of any record: the shared record counts as unsaved work
    initial.current = ''
    setMessage(`Opened the shared ${record.name}; Save keeps it.`)
  }

  /** States once when the browser refuses persistent storage after a write. */
  const noteStorage = () =>
    requestPersistentStorage().then((ok) => {
      if (!ok)
        setStorageNote(
          'The browser did not grant persistent storage and may clear its records; Export all keeps a copy.',
        )
    })

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(`${what} copied (${text.length} characters).`)
    } catch {
      setCopyText({ title: what, text })
    }
  }

  const current = () =>
    ({ kind, id: id.current ?? newId(), name, saved: new Date().toISOString(), data }) as Of<K>
  useReportOptions(
    reportBox === undefined
      ? undefined
      : [
          {
            label: reportBox,
            heading: 'Design',
            text: async () =>
              problem
                ? `No share link: ${problem}`
                : ((await shareLink(
                    current(),
                    window.location.origin + window.location.pathname,
                  )) ?? `No share link: longer than ${maxLinkChars} characters.`),
          },
        ],
  )

  async function share() {
    if (problem) return setFailure(`Not shared: ${problem}`)
    const page = window.location.origin + window.location.pathname
    const link = await shareLink(current(), page)
    if (!link)
      return setFailure(
        `Not shared: the link would be longer than ${maxLinkChars} characters; save the record to a file instead.`,
      )
    await copy(link, 'Share link')
  }

  async function remove(records: Of<K>[], question: string) {
    if (!records.length || !(await ask(question, 'Delete'))) return
    await deleteRecords(records.map((r) => r.id))
    onStored?.()
    setList((l) => l?.filter((r) => !records.includes(r)))
    // the shown record opened from the browser has no other copy now: it becomes unsaved work
    const only = saved?.file.endsWith(' (browser)') && records.some((r) => r.id === id.current)
    if (only) {
      setSaved(undefined)
      initial.current = ''
      known.current = undefined
    }
    setMessage(
      `Deleted ${records.length === 1 ? records[0].name : `${records.length} ${kindNames[kind]}`} from this browser; ${only ? 'the page keeps the shown record as unsaved work' : 'the page and saved files keep their copies'}.`,
    )
  }

  async function removeAll() {
    if (!list?.length) return
    // Skip export (or Escape) goes on to the delete question, where Cancel keeps everything
    if (
      (await confirmDialog({
        title: 'Export all records of this browser to a file before deleting?',
        confirmLabel: 'Export first',
        cancelLabel: 'Skip export',
      })) &&
      !(await exportAll())
    )
      return setMessage('Not deleted: the export was not saved.')
    await remove(
      list,
      `Delete all ${list.length} ${kindNames[kind]} from this browser? This cannot be undone.`,
    )
  }

  /** Shows `record` unless the user keeps the unsaved changes; false when kept. */
  async function use(record: Of<K>, file: string, h?: FileSystemFileHandle) {
    if (unsaved && !(await ask('Replace the unsaved changes with the opened record?', 'Replace')))
      return false
    onOpen(record.data as Of<K>['data'], record.name, record)
    id.current = record.id
    handle.current = h
    known.current = record.saved
    setSaved({ file, json: keyOf(record.data, record.name) })
    return true
  }

  async function open() {
    const [picked] = await pickFiles(false, ready)
    if (!picked) return
    const text = await read(picked.file)
    const parsed: ParsedUserFile =
      text === undefined ? { ok: false, reason: tooLargeMessage } : readLoadFile(text)
    if (!parsed.ok) {
      setMessage(`${picked.file.name} not opened: ${parsed.reason}`)
      return
    }
    const mine = parsed.records.filter((r): r is Of<K> => r.kind === kind)
    if (mine.length !== 1) {
      setMessage(
        `${picked.file.name} holds ${mine.length} ${kindNames[kind]}; Open takes a file with one, Import takes collections.`,
      )
      return
    }
    if (autosaved) {
      // kept in the browser at once, with its photo, as the page keeps every change
      const r = mine[0]
      const stored = await storedRecord(r.id).catch(() => undefined)
      if (
        stored &&
        canonicalJson(stored.data) !== canonicalJson(r.data) &&
        !(await ask(
          `Replace the browser copy of ${stored.name} with the one in the file?`,
          'Replace',
        ))
      )
        return
      await storePhotos(parsed.files ?? [], [r])
      await putRecords([r])
      onStored?.()
    }
    // Save writes back only to a file of this record alone
    const note = readNote(parsed)
    if (
      (await use(
        mine[0],
        picked.file.name,
        ownsFile(text, mine[0].id) ? picked.handle : undefined,
      )) &&
      note
    )
      setMessage(`${picked.file.name} opened. ${note}`)
  }

  /** True when a file was written. */
  async function exportAll() {
    const { records, invalid } = await storedRecords()
    if (!records.length && !invalid.length) {
      setMessage('No records in this browser yet; Save keeps a record here.')
      return false
    }
    const checked = exportAllText(records, await photosOf(records), invalid)
    if (!checked.ok) {
      setFailure(`Not exported: ${checked.reason}`)
      return false
    }
    const without = records.flatMap((s) =>
      s.kind === 'targetSheet' && checked.left.includes(s.data.photo ?? '') ? [s.name] : [],
    )
    const photos = without.length
      ? ` Left out for the file size limit: the photos of ${without.join(', ')}. Save on a sheet keeps its photo.`
      : ''
    const day = localDay(new Date())
    const r = await saveAs(checked.text, `openreloading-data-${day}.json`, ready)
    if (r) {
      const raw = invalid.length
        ? ` ${invalid.length} invalid ${invalid.length === 1 ? 'record is' : 'records are'} in it as stored.`
        : ''
      setMessage(`Exported ${records.length} records to ${r.name}.${raw}${photos}`)
      onExported?.()
    }
    return r !== undefined
  }

  async function importFiles() {
    const picked = await pickFiles(true, ready)
    if (!picked.length) return
    await importTexts(picked.map(({ file }) => ({ name: file.name, text: () => read(file) })))
  }

  /** Reads and stores one file at a time, so several large files are not held at once. */
  async function importTexts(files: { name: string; text: () => Promise<string | undefined> }[]) {
    const total: Report = {
      added: 0,
      equal: 0,
      skipped: [],
      notes: [],
      conflicts: [],
      files: [],
    }
    let count = 0
    for (const f of files) {
      const {
        records,
        files: photos,
        skipped,
        notes,
      } = parseFiles([{ name: f.name, text: await f.text() }])
      count += records.length
      const plan = planImport(records, (await storedRecords()).records)
      try {
        // an equal record may come to a browser without its photo
        await storePhotos(photos, [...plan.added, ...plan.equal])
        await putRecords(plan.added)
      } catch (e) {
        setFailure(`Import read ${count} records; the browser store write failed: ${errorText(e)}`)
        if (total.added) onStored?.()
        return
      }
      total.added += plan.added.length
      total.equal += plan.equal.length
      total.skipped.push(...skipped)
      total.notes.push(...notes)
      total.conflicts.push(...plan.conflicts)
      // kept for Replace: only the photos of the records it may store
      const wanted = new Set(photoIds(plan.conflicts.map((c) => c.incoming)))
      total.files.push(...photos.filter((p) => wanted.has(p.id)))
    }
    onStored?.()
    noteStorage()
    setReport(total)
  }

  async function replace() {
    if (!report) return
    const incoming = report.conflicts.map((c) => c.incoming)
    await storePhotos(report.files, incoming)
    await putRecords(incoming)
    // a target sheet replaced with another photo leaves its old photo unreferenced; the page's
    // record keeps its photo until the page shows the replaced one (`onStored`)
    const used = await storedPhotoIds()
    const left = droppedPhotos(
      report.conflicts.map((c) => c.stored),
      [current()],
    ).filter((p) => !used.has(p))
    for (const p of left) deletePhoto(p).catch(() => {})
    onStored?.()
    setReport(undefined)
    setMessage(`Replaced ${report.conflicts.length} browser records.`)
  }

  async function browserRecords() {
    setList((await storedRecords()).records.filter((r): r is Of<K> => r.kind === kind))
  }

  /** Counts the invalid records when the Open menu opens, so its entry shows only when there are some. */
  async function countInvalid() {
    setInvalidCount((await storedRecords().catch(() => undefined))?.invalid.length ?? 0)
  }

  async function invalidRecords() {
    setInvalidList((await storedRecords()).invalid)
  }

  async function pickFolder() {
    const handle = await chooseFolder()
    if (handle) setFolder({ handle, allowed: true })
  }

  async function reconnect() {
    if (folder)
      setFolder({ handle: folder.handle, allowed: await folderAllowed(folder.handle, true) })
  }

  const folderItems = folderApi && (
    <>
      <Menu.Divider />
      <Menu.Label>Workspace folder</Menu.Label>
      {folder && !folder.allowed && (
        <Menu.Item onClick={act('Reconnect', reconnect)}>
          Reconnect folder {folder.handle.name}
        </Menu.Item>
      )}
      <Menu.Item onClick={act('Folder', pickFolder)}>
        {folder ? 'Change workspace folder…' : 'Choose workspace folder…'}
      </Menu.Item>
      {folder && (
        <Menu.Item
          onClick={act('Forget', async () => {
            await forgetFolder()
            setFolder(undefined)
          })}
        >
          Forget workspace folder
        </Menu.Item>
      )}
    </>
  )

  return (
    <Group gap="xs" className="file-menu">
      {/* the focus placeholder is a focusable role="presentation" child of the menu, which axe rejects */}
      <Menu position="bottom-end" withInitialFocusPlaceholder={false} onOpen={countInvalid}>
        <Menu.Target>
          <Button
            variant="default"
            leftSection={<FolderOpen aria-hidden="true" />}
            rightSection={<CaretDown size={12} aria-hidden="true" />}
          >
            Open
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {(onList || !autosaved) && (
            <>
              <Menu.Label>This browser</Menu.Label>
              <Menu.Item onClick={onList ?? act('Listing', browserRecords)}>
                Saved {kindNames[kind]}…
              </Menu.Item>
            </>
          )}
          {invalidCount > 0 && (
            <Menu.Item onClick={act('Listing', invalidRecords)}>
              Invalid records ({invalidCount})…
            </Menu.Item>
          )}
          <Menu.Label>File</Menu.Label>
          <Menu.Item onClick={act('Open', open)} {...keyed('open')}>
            Open file…
          </Menu.Item>
          <Menu.Item onClick={act('Import', importFiles)}>Import…</Menu.Item>
          <Menu.Item onClick={() => setPasted('')}>Paste JSON…</Menu.Item>
          {examples && examples.length > 0 && (
            <>
              <Menu.Label>Examples</Menu.Label>
              {examples.map((x) => (
                <Menu.Item key={x.label} onClick={x.run}>
                  {x.label}
                </Menu.Item>
              ))}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      <Button.Group className="save-group">
        <Button
          variant="default"
          leftSection={<FloppyDisk aria-hidden="true" />}
          onClick={commands.save}
          title={`Save (${shortcutLabel('save')})`}
          aria-keyshortcuts={shortcutAriaKeys('save')}
        >
          Save
        </Button>
        <Menu position="bottom-end" withInitialFocusPlaceholder={false}>
          <Menu.Target>
            <Button variant="default" className="save-more" aria-label="Save options">
              <CaretDown size={12} aria-hidden="true" />
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={act('Save as', () => save(true))} {...keyed('saveAs')}>
              Save as…
            </Menu.Item>
            {shareable.includes(kind) && (
              <Menu.Item onClick={act('Share', share)}>Copy share link</Menu.Item>
            )}
            <Menu.Item onClick={act('Copy', () => copy(userDataText([current()]), 'Record JSON'))}>
              Copy JSON
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              onClick={act('Export', async () => {
                await exportAll()
              })}
            >
              Export all…
            </Menu.Item>
            {folderItems}
          </Menu.Dropdown>
        </Menu>
      </Button.Group>
      {bar === undefined ? status : bar && createPortal(status, bar)}
      <AppModal opened={report !== undefined} onClose={() => setReport(undefined)} title="Import">
        {report && (
          <>
            <p>
              {report.added} records added, {report.equal} already in this browser,{' '}
              {report.skipped.length} files skipped.
            </p>
            {report.skipped.length > 0 && (
              <ul className="file-skipped">
                {report.skipped.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>: <span className="file-reason">{s.reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {report.notes.length > 0 && (
              <ul className="file-skipped">
                {report.notes.map((n) => (
                  <li key={n.name}>
                    <strong>{n.name}</strong>: <span className="file-reason">{n.note}</span>
                  </li>
                ))}
              </ul>
            )}
            {report.conflicts.length > 0 ? (
              <>
                <p>
                  {report.conflicts.length} records have the id of a browser record with other
                  content: {report.conflicts.map((c) => c.stored.name).join(', ')}. Replace the
                  browser copies?
                </p>
                <Group>
                  <Button onClick={act('Replace', replace)}>Replace</Button>
                  <Button variant="default" onClick={() => setReport(undefined)}>
                    Keep browser copies
                  </Button>
                </Group>
              </>
            ) : (
              <Button onClick={() => setReport(undefined)}>Close</Button>
            )}
          </>
        )}
      </AppModal>
      <AppModal
        opened={list !== undefined}
        onClose={() => setList(undefined)}
        title={`Saved ${kindNames[kind]} in this browser`}
      >
        {list?.length ? (
          <ul className="file-records">
            {list.map((r) => (
              <li key={r.id}>
                <Button
                  variant="subtle"
                  onClick={async () => {
                    if (await use(r, `${r.name} (browser)`)) setList(undefined)
                  }}
                >
                  {r.name}
                </Button>{' '}
                <span className="file-reason">
                  saved {new Date(r.saved).toLocaleString()}
                  {parentOf(r) && `, from ${parentOf(r)?.title}`}
                </span>{' '}
                <Button
                  variant="subtle"
                  color="red"
                  size={controlSize.row.button}
                  aria-label={`Delete ${r.name}`}
                  onClick={act('Delete', () =>
                    remove([r], `Delete ${r.name} from this browser? This cannot be undone.`),
                  )}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>None yet; Save and Import keep records here.</p>
        )}
        {list && list.length > 0 && (
          <Button variant="default" color="red" onClick={act('Delete all', removeAll)}>
            Delete all {kindNames[kind]}…
          </Button>
        )}
      </AppModal>
      <AppModal
        opened={invalidList !== undefined}
        onClose={() => setInvalidList(undefined)}
        title="Invalid records in this browser"
      >
        <p>
          These records do not pass the current format. They stay in this browser, are not shown
          elsewhere and are in Export all as stored.
        </p>
        <ul className="file-records">
          {invalidList?.map((r) => (
            <li key={String((r.raw as { id?: unknown } | null)?.id)}>
              <strong>{r.name ?? r.id ?? 'Unnamed record'}</strong>{' '}
              <span className="file-reason">{[r.kind, r.id].filter(Boolean).join(', ')}</span>{' '}
              <Button
                variant="subtle"
                size={controlSize.row.button}
                onClick={() =>
                  download(
                    new Blob([`${JSON.stringify(r.raw, null, 2)}\n`], { type: 'application/json' }),
                    recordFileName(`invalid ${r.id ?? r.name ?? 'record'}`),
                  )
                }
              >
                Download raw
              </Button>
              <pre className="file-error">{r.error}</pre>
            </li>
          ))}
        </ul>
      </AppModal>
      <AppModal
        opened={copyText !== undefined}
        onClose={() => setCopyText(undefined)}
        title={`${copyText?.title ?? ''}: copy it by hand`}
      >
        <Textarea
          label="The clipboard is not available here"
          readOnly
          autosize
          maxRows={10}
          value={copyText?.text ?? ''}
          onFocus={(e) => e.currentTarget.select()}
        />
      </AppModal>
      <AppModal
        opened={pasted !== undefined}
        onClose={() => setPasted(undefined)}
        title="Paste JSON"
      >
        <Textarea
          label="User data file text"
          description="Checked as Import checks a file."
          autosize
          minRows={4}
          maxRows={12}
          value={pasted ?? ''}
          onChange={(e) => setPasted(e.currentTarget.value)}
        />
        <Group mt="sm">
          <Button
            disabled={!pasted?.trim()}
            onClick={act('Paste', async () => {
              const text = pasted ?? ''
              setPasted(undefined)
              await importTexts([{ name: 'Pasted text', text: async () => text }])
            })}
          >
            Import
          </Button>
        </Group>
      </AppModal>
    </Group>
  )
}

/** Open and Save disabled, in their place until a page's record exists. */
export function FileMenuPlaceholder() {
  return (
    <Group gap="xs" className="file-menu">
      <Button
        variant="default"
        disabled
        leftSection={<FolderOpen aria-hidden="true" />}
        rightSection={<CaretDown size={12} aria-hidden="true" />}
      >
        Open
      </Button>
      <Button.Group className="save-group">
        <Button variant="default" disabled leftSection={<FloppyDisk aria-hidden="true" />}>
          Save
        </Button>
        <Button variant="default" disabled className="save-more" aria-label="Save options">
          <CaretDown size={12} aria-hidden="true" />
        </Button>
      </Button.Group>
    </Group>
  )
}

/** Memoized: pages pass deferred data and a stable `onOpen`, so an edit renders the menu later. */
export const FileMenu = memo(FileMenuOf) as typeof FileMenuOf
