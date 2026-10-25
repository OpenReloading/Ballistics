'use client'

import { Button, Group, Kbd, Menu, Textarea } from '@mantine/core'
import {
  type EmbeddedFile,
  parseRef,
  type UserRecord,
  type UserRecordKind,
  userRecord,
} from '@open-reloading/schema'
import { CaretDown, FloppyDisk, FolderOpen } from '@phosphor-icons/react'
import {
  memo,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { localDay } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import { exampleFirearm } from '../lib/example-data.ts'
import {
  pickFiles,
  readHandleText,
  saveAs,
  saveToFolder,
  writeHandleText,
} from '../lib/file-access.ts'
import { parseFiles, readLoadFile, readNote } from '../lib/load-file-formats.ts'
import { shownManufacturerRefs } from '../lib/manufacturers.ts'
import { guardNavigation, guardPop } from '../lib/navigation-guard.ts'
import { newId } from '../lib/new-id.ts'
import { maxLinkChars, readLink, shareLink, shareProblem } from '../lib/share-link.ts'
import { type ShortcutId, shortcutAriaKeys, shortcutLabel } from '../lib/shortcuts.ts'
import { controlSize } from '../lib/theme.ts'
import {
  canonicalJson,
  checkedUserDataText,
  exportAllText,
  type InvalidRecord,
  makerIdOf,
  makerRecordsOf,
  makersToCarry,
  maxFileBytes,
  namedKey,
  type ParsedUserFile,
  parseUserDataFile,
  planImport,
  refNote,
  renamedKey,
  tooLargeMessage,
  userDataText,
  validRecords,
} from '../lib/user-data.ts'
import { ownsFile, recordFileName } from '../lib/user-file-names.ts'
import { droppedPhotos, embeddedFileBlob, embedFiles, photoIds } from '../lib/user-photos.ts'
import {
  deletePhoto,
  deleteRecords,
  putInvalid,
  putPhoto,
  putRecordIfAbsent,
  putRecords,
  rawPhotoId,
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

/** The records the pages resolve themselves, never stored. */
const builtIn = userRecord.parse(exampleFirearm)

type Of<K extends UserRecordKind> = Extract<UserRecord, { kind: K }>

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
  manufacturer: 'manufacturers',
  bullet: 'bullet designs',
  cartridge: 'cartridge designs',
  caseCapacity: 'measured capacities',
  load: 'loads',
  firearm: 'firearms',
  session: 'chronograph sessions',
  targetSheet: 'target sheets',
  targetFaceDesign: 'target face designs',
}

/** Shown when a manufacturer that came with a record could not be kept in the browser. */
const noMaker =
  'Its manufacturer could not be kept in this browser; Save still writes it into the file.'

/** Kinds a share link carries: the designs and the workbench load. */
const shareable: UserRecordKind[] = ['bullet', 'cartridge', 'load']

const basedOnOf = (r: UserRecord) =>
  r.kind === 'bullet' || r.kind === 'cartridge' ? r.data.basedOn : undefined

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
  /** The `invalid` entries of the files: stored as invalid records, left out for an id the browser has, or unstorable. */
  invalid: { added: number; kept: number; unstorable: number }
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

/** The user manufacturer `record` names, as `carried` holds it, kept unless one of its id is stored; false when the store refused it. */
async function keepMakers(record: UserRecord, carried: UserRecord[]) {
  try {
    await Promise.all(makerRecordsOf(record, carried).map(putRecordIfAbsent))
    return true
  } catch {
    return false
  }
}

/** `refNote` of `opened` against the browser store and the built-in example rifle; empty when the store cannot be read. */
async function refsOf(opened: UserRecord[]) {
  const stored = await storedRecords().catch(() => undefined)
  return stored ? refNote(opened, [builtIn, ...stored.records]) : ''
}

const keptText: Record<string, string> = {
  blank: '',
  saving: 'Saving in this browser',
  failed: 'Not saved in this browser',
}

/** The file state shown in the page bar. */
function stateText({
  saved,
  dirty,
  autosaved,
  kept,
  unsaved,
}: {
  saved: { file: string } | undefined
  dirty: boolean
  autosaved: string | undefined
  kept: string | undefined
  unsaved: boolean
}) {
  if (saved) {
    if (!dirty) return `Saved: ${saved.file}`
    return autosaved ? `Changed since ${saved.file}` : `Unsaved changes (${saved.file})`
  }
  // an autosaved record is kept in the browser until a file is written
  if (autosaved) return keptText[kept ?? ''] ?? 'Saved in this browser'
  return unsaved ? 'Unsaved changes, not saved to a file' : 'Not saved to a file'
}

/** The question while it shows: a second way out asked meanwhile waits for the same answer. */
function createLeave() {
  let leaving = false
  let asking: Promise<boolean> | undefined
  /** True once the user chose to leave; asked once. */
  const leave = () => {
    if (leaving) return Promise.resolve(true)
    asking ??= ask('Leave this page? Changes not saved to a file are lost.', 'Leave').then((go) => {
      leaving = go
      asking = undefined
      return go
    })
    return asking
  }
  return { leave, leaving: () => leaving, asking: () => asking !== undefined }
}

/** The link of a click that would leave this page, undefined for any other click. */
function leavingLink(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!(a instanceof HTMLAnchorElement) || a.target === '_blank' || a.hasAttribute('download'))
    return
  const to = new URL(a.href)
  const here = window.location
  if (to.origin !== here.origin || (to.pathname === here.pathname && to.search === here.search))
    return
  return a
}

/**
 * Unsaved work: the browser's leave-page prompt, a question before an in-app link or a router push
 * or replace, and a guard history entry with this URL, so Back and Forward ask too. Returns the
 * cleanup.
 */
function guardLeaving(say: (message: string) => void) {
  const { leave, leaving, asking } = createLeave()
  /** Set while a Back taken during the question is undone by a step forward. */
  let undoing = false
  const warn = (e: BeforeUnloadEvent) => e.preventDefault()
  const link = (e: MouseEvent) => {
    if (leaving()) return
    const a = leavingLink(e)
    if (!a) return
    // held while the dialog asks; on yes the same click again, which passes then
    e.preventDefault()
    e.stopPropagation()
    void leave().then((go) => go && a.click())
  }
  const guard = { ...window.history.state, fileGuard: true }
  // the guard entry replaces the forward entries (Navigation API, Chromium; elsewhere unknown)
  if ((window as { navigation?: { canGoForward: boolean } }).navigation?.canGoForward)
    say('Forward is not available while changes are not saved to a file.')
  window.history.pushState(guard, '', window.location.href)
  // through guardPop: runs before the router, which must not see a move off the guard entry
  const pop = (e: PopStateEvent) => {
    e.stopImmediatePropagation()
    if (undoing) {
      undoing = false
      return
    }
    // a second Back while the first asks: undone, so the first's answer acts on its own step
    if (asking()) {
      undoing = true
      window.history.go(1)
      return
    }
    void leave().then((go) => {
      if (!go) {
        window.history.pushState(guard, '', window.location.href)
        say('Stayed on this page to keep the changes not saved to a file.')
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
    if (!leaving() && window.history.state?.fileGuard) window.history.back()
  }
}

/** What the page offers a share link: the record, and how it is opened, kept and reported. */
interface SharedLink<K extends UserRecordKind> {
  unsaved: () => boolean
  open: (record: Of<K>) => void
  carry: (record: Of<K>, records: UserRecord[]) => void
  say: (message: string) => void
  fail: (message: string) => void
}

/** A share link: the record in the fragment, validated, opened as unsaved work. */
async function openSharedLink<K extends UserRecordKind>(kind: K, page: SharedLink<K>) {
  const p = await readLink(window.location.hash)
  if (!p) return
  window.history.replaceState(window.history.state, '', window.location.href.split('#')[0])
  if (!p.ok) return page.say(`Shared link not opened: ${p.reason}`)
  const r = p.records.find((x): x is Of<K> => x.kind === kind)
  if (!r) return page.say(`Shared link not opened: it holds no ${kindNames[kind]}.`)
  if (
    page.unsaved() &&
    !(await ask('Replace the unsaved changes with the shared record?', 'Replace'))
  )
    return
  const kept = await keepMakers(r, p.records)
  page.carry(r, p.records)
  page.open(r)
  if (!kept) page.fail(noMaker)
}

/** A copy saved after this tab's one (another tab or window) is overwritten only on yes, asked once. */
function newerGuard(known: () => string | undefined) {
  let agreed = false
  return async (other: string | undefined) => {
    const mine = known()
    if (agreed || !mine || !other || other <= mine) return true
    agreed = await confirmDialog({
      title: 'Overwrite the newer copy?',
      message: `A newer copy of this record was saved at ${new Date(other).toLocaleString()} (another tab or window); this tab has the copy saved at ${new Date(mine).toLocaleString()}.`,
      confirmLabel: 'Overwrite',
      danger: true,
    })
    return agreed
  }
}

/** The time a file's text gives the record `recordId`. */
const savedIn = (t: string | undefined, recordId: string) => {
  const p = t === undefined ? undefined : parseUserDataFile(t)
  return p?.ok ? p.records.find((r) => r.id === recordId)?.saved : undefined
}

/**
 * Writes the record's file: the kept file while it holds this record alone (not an Export all
 * file), else the workspace folder, else a file picked. `current` is the kept file's text.
 * 'newer' when the user keeps a newer copy, undefined when the picker was dismissed.
 */
async function writeRecordFile(o: {
  handle: FileSystemFileHandle | undefined
  current: string | undefined
  as: boolean
  ready: FileSystemDirectoryHandle | undefined
  name: string
  recordId: string
  text: string
  allow: (other: string | undefined) => Promise<boolean>
}): Promise<'newer' | { name: string; handle?: FileSystemFileHandle } | undefined> {
  const { handle, current, as, ready, name, recordId, text, allow } = o
  if (handle && ownsFile(current, recordId)) {
    if (!(await allow(savedIn(current, recordId)))) return 'newer'
    await writeHandleText(handle, text)
    return { name: handle.name, handle }
  }
  if (!as && ready) {
    const h = await saveToFolder(ready, recordFileName(name), recordId, text, (t) =>
      allow(savedIn(t, recordId)),
    )
    return h ? { name: h.name, handle: h } : 'newer'
  }
  return saveAs(text, recordFileName(name), ready)
}

/** The file of Open: its one record of `kind`, or the message that says why not. */
async function readOpened<K extends UserRecordKind>(file: File, kind: K) {
  const text = await read(file)
  const parsed: ParsedUserFile =
    text === undefined ? { ok: false, reason: tooLargeMessage } : readLoadFile(text)
  if (!parsed.ok) return { problem: `${file.name} not opened: ${parsed.reason}` }
  const mine = parsed.records.filter((r): r is Of<K> => r.kind === kind)
  if (mine.length !== 1)
    return {
      problem: `${file.name} holds ${mine.length} ${kindNames[kind]}; Open takes a file with one, Import takes collections.`,
    }
  return { parsed, text, mine: mine[0] }
}

/** Stores the opened record and its photo in the browser; false when the user keeps the browser copy. */
async function keepInBrowser(r: UserRecord, files: EmbeddedFile[]) {
  const stored = await storedRecord(r.id).catch(() => undefined)
  if (
    stored &&
    canonicalJson(stored.data) !== canonicalJson(r.data) &&
    !(await ask(`Replace the browser copy of ${stored.name} with the one in the file?`, 'Replace'))
  )
    return false
  await storePhotos(files, [r])
  await putRecords([r])
  return true
}

/** The sentences after an export: the photos left out for the size limit and the invalid records in it. */
function exportNotes(records: UserRecord[], invalid: InvalidRecord[], left: string[]) {
  const without = records.flatMap((s) =>
    s.kind === 'targetSheet' && left.includes(s.data.photo ?? '') ? [s.name] : [],
  )
  const photos = without.length
    ? ` Left out for the file size limit: the photos of ${without.join(', ')}. Save on a sheet keeps its photo.`
    : ''
  const raw = invalid.length
    ? ` ${invalid.length} invalid ${invalid.length === 1 ? 'record is' : 'records are'} in it as stored.`
    : ''
  return `${raw}${photos}`
}

/** What an import reports to: the store hooks and the page's messages. */
interface ImportIo {
  onStored?: () => void
  noteStorage: () => void
  fail: (message: string) => void
  show: (report: Report) => void
}

/** Reads and stores one file at a time, so several large files are not held at once. */
async function importTexts(
  files: { name: string; text: () => Promise<string | undefined> }[],
  io: ImportIo,
) {
  const total: Report = {
    added: 0,
    equal: 0,
    skipped: [],
    notes: [],
    conflicts: [],
    invalid: { added: 0, kept: 0, unstorable: 0 },
    files: [],
  }
  let count = 0
  const added: UserRecord[] = []
  for (const f of files) {
    const {
      records,
      files: photos,
      invalid,
      skipped,
      notes,
    } = parseFiles([{ name: f.name, text: await f.text() }])
    count += records.length
    const plan = planImport(records, (await storedRecords()).records)
    try {
      // an equal record may come to a browser without its photo
      await storePhotos(photos, [...plan.added, ...plan.equal])
      await putRecords(plan.added)
      // after the valid records, and never over a record with its id
      const stored = await putInvalid(invalid)
      for (const k of ['added', 'kept', 'unstorable'] as const) total.invalid[k] += stored[k]
    } catch (e) {
      io.fail(`Import read ${count} records; the browser store write failed: ${errorText(e)}`)
      if (total.added) io.onStored?.()
      return
    }
    added.push(...plan.added)
    total.added += plan.added.length
    total.equal += plan.equal.length
    total.skipped.push(...skipped)
    total.notes.push(...notes)
    total.conflicts.push(...plan.conflicts)
    // kept for Replace: only the photos of the records it may store
    const wanted = new Set(photoIds(plan.conflicts.map((c) => c.incoming)))
    total.files.push(...photos.filter((p) => wanted.has(p.id)))
  }
  // once all files are stored, so a reference to a record of a later file resolves
  const refs = await refsOf(added)
  if (refs) total.notes.push({ name: 'References', note: refs })
  io.onStored?.()
  io.noteStorage()
  io.show(total)
}

/** Restores the remembered workspace folder; says so when it was lost. */
function restoreFolderInto(
  setFolder: (folder: { handle: FileSystemDirectoryHandle; allowed: boolean }) => void,
  say: (message: string) => void,
) {
  restoreFolder()
    .then(async (h) => {
      if (h === 'lost') say('The workspace folder could not be restored; choose it again.')
      else if (h) setFolder({ handle: h, allowed: await folderAllowed(h, false) })
    })
    .catch(() => {})
}

/** The Open menu's Examples section: the page's starting points. */
function ExampleItems({ examples }: { examples: FileMenuItem[] | undefined }) {
  if (!examples || examples.length === 0) return null
  return (
    <>
      <Menu.Label>Examples</Menu.Label>
      {examples.map((x) => (
        <Menu.Item key={x.label} onClick={x.run}>
          {x.label}
        </Menu.Item>
      ))}
    </>
  )
}

/**
 * Unsaved work: nothing for a record kept in the browser on every change; for a saved one whether
 * it changed since (`dirty`); else whether the text differs from the one the record started with
 * (none yet counts as unchanged).
 */
function isUnsaved(
  autosaved: string | undefined,
  dirty: boolean | undefined,
  initial: string | undefined,
  now: string,
) {
  if (autosaved) return false
  if (dirty !== undefined) return dirty
  return initial !== undefined && now !== initial
}

/** The status in the page bar's status line when there is one, else in place. */
const inBar = (bar: HTMLElement | null | undefined, status: ReactNode) =>
  bar === undefined ? status : bar && createPortal(status, bar)

/** The Report issue box that adds the record's share link, none without a label. */
const reportOption = (
  label: string | undefined,
  problem: string | undefined,
  records: () => Promise<UserRecord[]>,
) =>
  label === undefined
    ? undefined
    : [
        {
          label,
          heading: 'Design',
          text: async () =>
            problem
              ? `No share link: ${problem}`
              : ((await shareLink(
                  await records(),
                  window.location.origin + window.location.pathname,
                )) ?? `No share link: longer than ${maxLinkChars} characters.`),
        },
      ]

/** Runs `snapshot` once `filling` has settled, at once when it is no promise. */
function settled(filling: unknown, snapshot: () => void, say: (message: string) => void) {
  if (filling instanceof Promise) filling.finally(snapshot).catch((e) => say(errorText(e)))
  else snapshot()
}

function BrowserItems({
  shown,
  kind,
  onList,
}: {
  shown: boolean
  kind: string
  onList: () => void
}) {
  if (!shown) return null
  return (
    <>
      <Menu.Label>This browser</Menu.Label>
      <Menu.Item onClick={onList}>Saved {kind}…</Menu.Item>
    </>
  )
}

function ApiItems({ onDownload, onCopy }: { onDownload: () => void; onCopy: () => void }) {
  return (
    <>
      <Menu.Item onClick={onDownload}>Download for the API</Menu.Item>
      <Menu.Item onClick={onCopy}>Copy JSON for the API</Menu.Item>
    </>
  )
}

function FolderItems({
  folder,
  onReconnect,
  onPick,
  onForget,
}: {
  folder: { handle: FileSystemDirectoryHandle; allowed: boolean } | undefined
  onReconnect: () => void
  onPick: () => void
  onForget: () => void
}) {
  return (
    <>
      <Menu.Divider />
      <Menu.Label>Workspace folder</Menu.Label>
      {folder && !folder.allowed && (
        <Menu.Item onClick={onReconnect}>Reconnect folder {folder.handle.name}</Menu.Item>
      )}
      <Menu.Item onClick={onPick}>
        {folder ? 'Change workspace folder…' : 'Choose workspace folder…'}
      </Menu.Item>
      {folder && <Menu.Item onClick={onForget}>Forget workspace folder</Menu.Item>}
    </>
  )
}

function FileStatus({
  idle,
  state,
  folderName,
  lines,
  failure,
  unsaved,
  autosaved,
  kept,
}: {
  /** No record is open: the status shows messages only. */
  idle: boolean | undefined
  state: string
  /** The workspace folder named after the state, none when it is not in use. */
  folderName: string | undefined
  lines: string
  failure: string
  unsaved: boolean
  autosaved: string | undefined
  kept: string | undefined
}) {
  const folder = folderName ? `, folder ${folderName}` : ''
  const shown = !idle
  return (
    <span
      className="file-status"
      title={[shown && `${state}${folder}`, lines, failure].filter(Boolean).join(' ')}
    >
      <span
        className="file-state"
        data-dirty={unsaved || (autosaved && kept === 'failed') || undefined}
        // also after a file is written, when the text is the file's state
        data-saving={(autosaved && kept === 'saving') || undefined}
        aria-live="polite"
      >
        {shown && state}
        {shown && folder}
      </span>
      <span role="status" className="file-message">
        {lines}
      </span>
      <span role="alert" className="file-message">
        {failure}
      </span>
    </span>
  )
}

function ImportReport({
  report,
  onClose,
  onReplace,
}: {
  report: Report
  onClose: () => void
  onReplace: () => void
}) {
  const { invalid } = report
  return (
    <>
      <p>
        {report.added} records added, {report.equal} already in this browser,{' '}
        {report.skipped.length} files skipped.
      </p>
      {invalid.added + invalid.kept + invalid.unstorable > 0 && (
        <p>
          {invalid.added} invalid {invalid.added === 1 ? 'record' : 'records'} restored
          {invalid.kept > 0 && `, ${invalid.kept} left out because a browser record has their id`}
          {invalid.unstorable > 0 && `, ${invalid.unstorable} left out without a text id`}.
        </p>
      )}
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
            {report.conflicts.length} records have the id of a browser record with other content:{' '}
            {report.conflicts.map((c) => c.stored.name).join(', ')}. Replace the browser copies?
          </p>
          <Group>
            <Button onClick={onReplace}>Replace</Button>
            <Button variant="default" onClick={onClose}>
              Keep browser copies
            </Button>
          </Group>
        </>
      ) : (
        <Button onClick={onClose}>Close</Button>
      )}
    </>
  )
}

function SavedList<R extends UserRecord>({
  list,
  kind,
  onUse,
  onDelete,
  onDeleteAll,
}: {
  list: R[] | undefined
  /** The plural name of the kind. */
  kind: string
  onUse: (record: R) => void
  onDelete: (record: R) => void
  onDeleteAll: () => void
}) {
  return (
    <>
      {list?.length ? (
        <ul className="file-records">
          {list.map((r) => (
            <li key={r.id}>
              <Button variant="subtle" onClick={() => onUse(r)}>
                {r.name}
              </Button>{' '}
              <span className="file-reason">
                saved {new Date(r.saved).toLocaleString()}
                {basedOnOf(r) && `, based on ${parseRef(basedOnOf(r) ?? '')?.id}`}
              </span>{' '}
              <Button
                variant="subtle"
                color="red"
                size={controlSize.row.button}
                aria-label={`Delete ${r.name}`}
                onClick={() => onDelete(r)}
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
        <Button variant="default" color="red" onClick={onDeleteAll}>
          Delete all {kind}…
        </Button>
      )}
    </>
  )
}

function InvalidItem({ record: r, onDelete }: { record: InvalidRecord; onDelete: () => void }) {
  return (
    <li>
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
      </Button>{' '}
      <Button variant="subtle" color="red" size={controlSize.row.button} onClick={onDelete}>
        Delete
      </Button>
      <pre className="file-error">{r.error}</pre>
    </li>
  )
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
  apiData,
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
  browserList,
  examples,
  reportBox,
  ref,
}: {
  kind: K
  /** The record's name, also the suggested file name. */
  name: string
  /** The page's current record data. */
  data: Of<K>['data']
  /**
   * The record as a file for the API reads it, every value resolved (the workbench): the Save
   * options then offer Download and Copy JSON for the API. Never saved, never the browser copy.
   */
  apiData?: Of<K>['data']
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
  /** With `autosaved` and no `onList`: the menu's own list of the browser's records (the page has none). */
  browserList?: boolean
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
    restoreFolderInto(setFolder, setMessage)
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
  const unsaved = isUnsaved(autosaved, saved ? dirty : undefined, initial.current, now)
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

  // Settings must not offer to delete the manufacturer of the record shown
  const shownMaker = makerIdOf({ kind, data } as UserRecord)
  useEffect(() => {
    if (!shownMaker) return
    const key = {}
    shownManufacturerRefs.set(key, `user:${shownMaker}`)
    return () => void shownManufacturerRefs.delete(key)
  }, [shownMaker])

  // a share link: the record in the fragment, validated, opened as unsaved work
  // on load, and on a link pasted into this tab (a fragment change, no reload)
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    if (!shareable.includes(kind)) return
    const read = () =>
      openSharedLink(kind, {
        unsaved: () => latest.current.unsaved,
        open: (r) => latest.current.openShared(r),
        carry: (r, records) => {
          carriedMakers.current = makerRecordsOf(r, records)
        },
        say: setMessage,
        fail: setFailure,
      }).catch(() => {})
    void read()
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
          if (next === undefined) settled(filling, snapshot, setMessage)
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
  useEffect(() => (unsaved ? guardLeaving(setMessage) : undefined), [unsaved])

  // an autosaved record is kept in the browser until a file is written
  const state = stateText({ saved, dirty, autosaved, kept, unsaved })
  const ready = folder?.allowed ? folder.handle : undefined
  // in a page bar the state and messages are its status line: one line, the whole text on hover
  const bar = useContext(BarStatus)
  const lines = [message, note, storageNote].filter(Boolean).join(' ')
  const status = (
    <FileStatus
      idle={idle}
      state={state}
      folderName={ready?.name}
      lines={lines}
      failure={failure}
      unsaved={unsaved}
      autosaved={autosaved}
      kept={kept}
    />
  )

  /** Runs a file action; a failure is shown, not thrown. */
  const act = (what: string, f: () => Promise<void>) => () => {
    setMessage('')
    setFailure('')
    f().catch((e: unknown) => setFailure(`${what} failed: ${errorText(e)}`))
  }

  /** The record to write and its checked file text; undefined after showing why not. */
  async function prepareSave(as: boolean) {
    if (problem) {
      setFailure(`Not saved: ${problem}`)
      return
    }
    const recordId = as || !id.current ? newId() : id.current
    const record = { kind, id: recordId, name, saved: new Date().toISOString(), data } as Of<K>
    // a file Open and Import would reject is not written
    const checked = checkedUserDataText(await withMakers(record), await photosOf([record]))
    if (!checked.ok) {
      setFailure(`Not saved: ${checked.reason}`)
      return
    }
    return { recordId, record, text: checked.text }
  }

  /** Writes the file of a prepared save; undefined when none was written (a newer copy kept, or no file picked). */
  async function writeSave(as: boolean, { recordId, text }: { recordId: string; text: string }) {
    const allow = newerGuard(() => known.current)
    // a failed read leaves the check to the file; the write reports the browser store failure; an
    // autosaved record's browser copy is this page's own
    const stored = !as && !autosaved && (await storedRecord(recordId).catch(() => undefined))
    if (stored !== false && !(await allow(stored?.saved))) return keptNewer()
    const current = !as && handle.current ? await readHandleText(handle.current) : undefined
    const written = await writeRecordFile({
      handle: handle.current,
      current,
      as,
      ready,
      name,
      recordId,
      text,
      allow,
    })
    return written === 'newer' ? keptNewer() : written
  }

  async function save(as: boolean) {
    const prepared = await prepareSave(as)
    if (!prepared) return
    const written = await writeSave(as, prepared)
    if (!written) return
    const { record } = prepared
    handle.current = written.handle
    id.current = record.id
    known.current = record.saved
    await keepBrowserCopy(record, written.name)
    // the file holds the record whether or not the browser copy was written
    setSaved({ file: written.name, json: keyOf(data, nameKey ?? '') })
    // the copy is what the page shows now
    if (autosaved && as) onOpen(data, name, record)
  }

  function keptNewer() {
    setMessage('Not saved: a newer copy was kept.')
  }

  /** The browser's copy of a saved record; a failure is shown, the file stays written. */
  async function keepBrowserCopy(record: Of<K>, file: string) {
    try {
      if (!store) await putRecords([record])
      if (!store || (await store(record))) onStored?.()
      void noteStorage()
    } catch (e) {
      setFailure(`Saved to ${file}; the browser copy failed: ${errorText(e)}`)
    }
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
  useReportOptions(reportOption(reportBox, problem, async () => withMakers(current())))

  async function share() {
    if (problem) return setFailure(`Not shared: ${problem}`)
    const refused = shareProblem(current())
    if (refused) return setFailure(`Not shared: ${refused}`)
    const page = window.location.origin + window.location.pathname
    const link = await shareLink(await withMakers(current()), page)
    if (!link)
      return setFailure(
        `Not shared: the link would be longer than ${maxLinkChars} characters; save the record to a file instead.`,
      )
    await copy(link, 'Share link')
  }

  /** The text of the file for the API, none (and the reason shown) when the record cannot be written. */
  function apiText() {
    if (problem || !apiData) {
      setFailure(`Not written: ${problem ?? 'nothing to write'}`)
      return
    }
    const checked = checkedUserDataText([{ ...current(), data: apiData }])
    if (checked.ok) return checked.text
    setFailure(`Not written: ${checked.reason}`)
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

  /** The user manufacturer records that came with the opened record, for a Save while the store lacks them. */
  const carriedMakers = useRef<UserRecord[]>([])

  /**
   * `record` and the user manufacturer it names, as a file, Copy JSON and a share link carry them:
   * the stored one (one keyed read; one the format rejects is left out), else the one that came
   * with the opened file or link. A failed read stops the action unless the opened file has it.
   */
  async function withMakers(record: UserRecord): Promise<UserRecord[]> {
    const id = makerIdOf(record)
    if (!id) return [record]
    let raw: unknown
    try {
      raw = await storedRecord(id)
    } catch (e) {
      if (!makerRecordsOf(record, carriedMakers.current).length) throw e
    }
    const stored = raw ? validRecords([raw]).records : []
    return [record, ...makersToCarry(record, stored, carriedMakers.current)]
  }

  /** Shows `record` unless the user keeps the unsaved changes; false when kept. */
  async function use(
    record: Of<K>,
    file: string,
    opened?: FileSystemFileHandle,
    fileNote?: string,
    carried: UserRecord[] = [],
  ) {
    if (unsaved && !(await ask('Replace the unsaved changes with the opened record?', 'Replace')))
      return false
    const kept = await keepMakers(record, carried)
    carriedMakers.current = makerRecordsOf(record, carried)
    const note = kept ? fileNote : [fileNote, noMaker].filter(Boolean).join(' ')
    onOpen(record.data as Of<K>['data'], record.name, record)
    id.current = record.id
    handle.current = opened
    known.current = record.saved
    setSaved({ file, json: keyOf(record.data, record.name) })
    const text = [note, await refsOf([record])].filter(Boolean).join(' ')
    if (text) setMessage(`${file} opened. ${text}`)
    return true
  }

  async function open() {
    const [picked] = await pickFiles(false, ready)
    if (!picked) return
    const opened = await readOpened(picked.file, kind)
    if (opened.problem !== undefined) {
      setMessage(opened.problem)
      return
    }
    const { parsed, text, mine } = opened
    // kept in the browser at once, with its photo, as the page keeps every change
    if (autosaved) {
      if (!(await keepInBrowser(mine, parsed.files ?? []))) return
      onStored?.()
    }
    // Save writes back only to a file of this record alone
    await use(
      mine,
      picked.file.name,
      ownsFile(text, mine.id) ? picked.handle : undefined,
      readNote(parsed),
      parsed.records,
    )
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
    const day = localDay(new Date())
    const r = await saveAs(checked.text, `openreloading-data-${day}.json`, ready)
    if (r) {
      setMessage(
        `Exported ${records.length} records to ${r.name}.${exportNotes(records, invalid, checked.left)}`,
      )
      onExported?.()
    }
    return r !== undefined
  }

  const importIo = {
    onStored,
    noteStorage: () => void noteStorage(),
    fail: setFailure,
    show: setReport,
  }

  async function importFiles() {
    const picked = await pickFiles(true, ready)
    if (!picked.length) return
    await importTexts(
      picked.map(({ file }) => ({ name: file.name, text: () => read(file) })),
      importIo,
    )
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
    setMessage(
      `Replaced ${report.conflicts.length} browser records. ${await refsOf(incoming)}`.trimEnd(),
    )
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

  async function removeInvalid(r: InvalidRecord) {
    const label = r.name ?? r.id ?? 'Unnamed record'
    if (
      !(await ask(
        `Delete the invalid record ${label} from this browser? This cannot be undone.`,
        'Delete',
      ))
    )
      return
    // the store's key may be no text: only a record with a text id shows an `id`
    await deleteRecords([(r.raw as { id: string }).id])
    // an invalid sheet's photo leaves with it unless another record points at it
    const photo = rawPhotoId(r.raw)
    if (photo && !(await storedPhotoIds()).has(photo)) deletePhoto(photo).catch(() => {})
    setInvalidList((l) => l?.filter((i) => i !== r))
    setInvalidCount((n) => n - 1)
    setMessage(`Deleted the invalid record ${label} from this browser.`)
  }

  async function pickFolder() {
    const handle = await chooseFolder()
    if (handle) setFolder({ handle, allowed: true })
  }

  async function forget() {
    await forgetFolder()
    setFolder(undefined)
  }

  /** Downloads the load file for the API. */
  function downloadApi() {
    const text = apiText()
    if (text !== undefined) {
      download(new Blob([text], { type: 'application/json' }), recordFileName(`${name} api`))
      setMessage('Downloaded the load file for the API.')
    }
    return Promise.resolve()
  }

  async function copyApi() {
    const text = apiText()
    if (text !== undefined) await copy(text, 'Load file for the API')
  }

  async function reconnect() {
    if (folder)
      setFolder({ handle: folder.handle, allowed: await folderAllowed(folder.handle, true) })
  }

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
          <BrowserItems
            shown={Boolean(onList || browserList || !autosaved)}
            kind={kindNames[kind]}
            onList={onList ?? act('Listing', browserRecords)}
          />
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
          <ExampleItems examples={examples} />
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
            <Menu.Item
              onClick={act('Copy', async () =>
                copy(userDataText(await withMakers(current())), 'Record JSON'),
              )}
            >
              Copy JSON
            </Menu.Item>
            {apiData && (
              <ApiItems onDownload={act('Download', downloadApi)} onCopy={act('Copy', copyApi)} />
            )}
            <Menu.Divider />
            <Menu.Item
              onClick={act('Export', async () => {
                await exportAll()
              })}
            >
              Export all…
            </Menu.Item>
            {folderApi && (
              <FolderItems
                folder={folder}
                onReconnect={act('Reconnect', reconnect)}
                onPick={act('Folder', pickFolder)}
                onForget={act('Forget', forget)}
              />
            )}
          </Menu.Dropdown>
        </Menu>
      </Button.Group>
      {inBar(bar, status)}
      <AppModal opened={report !== undefined} onClose={() => setReport(undefined)} title="Import">
        {report && (
          <ImportReport
            report={report}
            onClose={() => setReport(undefined)}
            onReplace={act('Replace', replace)}
          />
        )}
      </AppModal>
      <AppModal
        opened={list !== undefined}
        onClose={() => setList(undefined)}
        title={`Saved ${kindNames[kind]} in this browser`}
      >
        <SavedList
          list={list}
          kind={kindNames[kind]}
          onUse={async (r) => {
            if (await use(r, `${r.name} (browser)`)) setList(undefined)
          }}
          onDelete={(r) =>
            act('Delete', () =>
              remove([r], `Delete ${r.name} from this browser? This cannot be undone.`),
            )()
          }
          onDeleteAll={act('Delete all', removeAll)}
        />
      </AppModal>
      <AppModal
        opened={invalidList !== undefined}
        onClose={() => setInvalidList(undefined)}
        title="Invalid records in this browser"
      >
        <p>
          These records do not pass the current format. They stay in this browser, are not shown
          elsewhere and are in Export all as stored, which Import restores as invalid records.
        </p>
        <ul className="file-records">
          {invalidList?.map((r) => (
            <InvalidItem
              key={String((r.raw as { id?: unknown } | null)?.id)}
              record={r}
              onDelete={act('Delete', () => removeInvalid(r))}
            />
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
              await importTexts([{ name: 'Pasted text', text: async () => text }], importIo)
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
