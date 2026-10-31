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
  type Dispatch,
  memo,
  type ReactNode,
  type Ref,
  type SetStateAction,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import type { ImportFile, ImportReport as Report } from '../lib/data-files.ts'
import { dateTimeText, localDay } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import { exampleFirearm } from '../lib/example-data.ts'
import {
  pickFiles,
  readHandleText,
  saveAs,
  saveToFolder,
  tableFormats,
  writeHandleText,
} from '../lib/file-access.ts'
import { loadFileFormats, readLoadFile, readNote } from '../lib/load-file-formats.ts'
import { shownManufacturerRefs } from '../lib/manufacturers.ts'
import { guardNavigation, guardPop } from '../lib/navigation-guard.ts'
import { newId } from '../lib/new-id.ts'
import {
  linkReasonText,
  maxLinkChars,
  readLink,
  shareLink,
  shareProblem,
  tooLongText,
} from '../lib/share-link.ts'
import { type ShortcutId, shortcutAriaKeys, shortcutLabel } from '../lib/shortcuts.ts'
import { controlSize } from '../lib/theme.ts'
import {
  canonicalJson,
  checkedUserDataText,
  type InvalidRecord,
  linkedRecordsOf,
  makerIdOf,
  makerRecordsOf,
  makersToCarry,
  maxFileBytes,
  namedKey,
  type ParsedUserFile,
  parseUserDataFile,
  reasonText,
  refNote,
  renamedKey,
  tooLargeMessage,
  userDataText,
  validRecords,
} from '../lib/user-data.ts'
import { holdsSkipped, ownsFile, recordFileName } from '../lib/user-file-names.ts'
import { droppedPhotos, embedFiles, photoIds } from '../lib/user-photos.ts'
import {
  deletePhoto,
  deleteRecords,
  putRecordIfAbsent,
  putRecords,
  rawPhotoId,
  requestPersistentStorage,
  storedPhoto,
  storedPhotoIds,
  storedRecord,
  storedRecords,
  storePhotos,
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
import { focusBack } from './focus-back.ts'
import type { ImportEntry, TablesEntry } from './import-entry.tsx'
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

const kindNames: Record<UserRecordKind, Message> = {
  manufacturer: msg('manufacturers'),
  bullet: msg('bullet designs'),
  cartridge: msg('cartridge designs'),
  powder: msg('powder designs'),
  caseCapacity: msg('measured capacities'),
  case: msg('brass groups'),
  load: msg('loads'),
  firearm: msg('firearms'),
  session: msg('chronograph sessions'),
  targetSheet: msg('target sheets'),
  targetFaceDesign: msg('target designs'),
}

/** A line of the status, written when it is shown so that a change of language reaches it. */
type Said = (tr: Translator) => string

/** The setter of a status line: a state setter would call a `Said` as an update, so it is wrapped. */
const lineSetter = (set: Dispatch<SetStateAction<Said | undefined>>) => (said?: Said) =>
  set(said && (() => said))

const shownLine = (said: Said | undefined, tr: Translator) => (said ? said(tr) : '')

/** A line that is one fixed message. */
const plain =
  (text: Message): Said =>
  ({ t }) =>
    t(text)

/** Shown when a manufacturer that came with a record could not be kept in the browser. */
const noMaker = msg(
  'Its manufacturer could not be kept in this browser; Save still writes it into the file.',
)

/** Said once the browser refuses persistent storage. */
const noStorage = msg(
  'The browser did not grant persistent storage and may clear its records; Export all keeps a copy.',
)

/** Kinds a share link carries: the designs and the workbench load. */
const shareable: UserRecordKind[] = ['bullet', 'cartridge', 'load']

const basedOnOf = (r: UserRecord) =>
  r.kind === 'bullet' || r.kind === 'cartridge' ? r.data.basedOn : undefined

/**
 * What the menu holds about the record shown (its id, kept file and saved text), so a page with
 * several records open (the workbench tabs) puts it back when it shows that record again.
 */
export interface FileState {
  id?: string | undefined
  handle?: FileSystemFileHandle | undefined
  known?: string | undefined
  saved?: { file: string; json: string } | undefined
  /** The record's start text; undefined takes the data of the next render. */
  initial?: string | undefined
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

/** The user manufacturer `record` names, as `carried` holds it, kept unless one of its id is stored; false when the store refused it. */
async function keepMakers(record: UserRecord, carried: UserRecord[]) {
  try {
    await Promise.all(makerRecordsOf(record, carried).map(putRecordIfAbsent))
    return true
  } catch {
    return false
  }
}

/** The records `record` names that `carried` holds, kept unless one of its id is stored; a refusal leaves them to `refsOf`'s note. */
async function keepLinked(record: UserRecord, carried: UserRecord[]) {
  await Promise.all(linkedRecordsOf(record, carried).map(putRecordIfAbsent)).catch(() => {})
}

/** `refNote` of `opened` against the browser store and the built-in example rifle; empty when the store cannot be read. */
async function refsOf(opened: UserRecord[], t: Translator['t']) {
  const stored = await storedRecords().catch(() => undefined)
  return stored ? refNote(opened, [builtIn, ...stored.records], t) : ''
}

const keptText: Record<string, Message | ''> = {
  blank: '',
  saving: msg('Saving in this browser'),
  failed: msg('Not saved in this browser'),
}

/** The file state's text; `brief` is the page bar's shorter one, where `text` is the tooltip. */
interface FileState {
  text: string
  brief?: string
}

/** The file state shown in the page bar. */
function stateText(
  {
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
  },
  t: Translator['t'],
): FileState {
  if (saved) {
    if (!dirty) return { text: t('Saved: {file}', { file: saved.file }) }
    return autosaved
      ? { text: t('Changed since {file}', { file: saved.file }) }
      : { text: t('Unsaved changes ({file})', { file: saved.file }), brief: t('Unsaved') }
  }
  // an autosaved record is kept in the browser until a file is written
  if (autosaved) return { text: t(keptText[kept ?? ''] ?? msg('Saved in this browser')) }
  return unsaved
    ? { text: t('Unsaved changes, not saved to a file'), brief: t('Unsaved') }
    : { text: t('Not saved to a file') }
}

/** The question while it shows: a second way out asked meanwhile waits for the same answer. */
function createLeave(language: () => Translator['t']) {
  let leaving = false
  let asking: Promise<boolean> | undefined
  /** True once the user chose to leave; asked once. */
  const leave = () => {
    if (leaving) return Promise.resolve(true)
    const t = language()
    asking ??= ask(t('Leave this page? Changes not saved to a file are lost.'), t('Leave')).then(
      (go) => {
        leaving = go
        asking = undefined
        return go
      },
    )
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
function guardLeaving(say: (said: Said) => void, language: () => Translator['t']) {
  const { leave, leaving, asking } = createLeave(language)
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
    say(plain(msg('Forward is not available while changes are not saved to a file.')))
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
        say(plain(msg('Stayed on this page to keep the changes not saved to a file.')))
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
  open: (record: Of<K>, parsed: ParsedUserFile) => void
  carry: (record: Of<K>, records: UserRecord[]) => void
  say: (said: Said) => void
  fail: (said: Said) => void
}

/** A share link: the record in the fragment, validated, opened as unsaved work. */
async function openSharedLink<K extends UserRecordKind>(
  kind: K,
  page: SharedLink<K>,
  t: Translator['t'],
) {
  const p = await readLink(window.location.hash)
  if (!p) return
  window.history.replaceState(window.history.state, '', window.location.href.split('#')[0])
  if (!p.ok) {
    const { reason } = p
    return page.say(({ t }) =>
      t('Shared link not opened: {reason}', { reason: linkReasonText(reason, t) }),
    )
  }
  const r = p.records.find((x): x is Of<K> => x.kind === kind)
  if (!r)
    return page.say(({ t }) =>
      [
        t('Shared link not opened: it holds {kinds}, no {kind}.', {
          kinds: [
            ...new Set([
              ...p.records.map((x) => t(kindNames[x.kind])),
              ...(p.skipped ?? []).map((s) => s.kind),
            ]),
          ].join(', '),
          kind: t(kindNames[kind]),
        }),
        readNote(p, t),
      ]
        .filter(Boolean)
        .join(' '),
    )
  if (
    page.unsaved() &&
    !(await ask(t('Replace the unsaved changes with the shared record?'), t('Replace')))
  )
    return
  const kept = await keepMakers(r, p.records)
  page.carry(r, p.records)
  page.open(r, p)
  if (!kept) page.fail(plain(noMaker))
}

/** A copy saved after this tab's one (another tab or window) is overwritten only on yes, asked once. */
function newerGuard(known: () => string | undefined, t: Translator['t']) {
  let agreed = false
  return async (other: string | undefined) => {
    const mine = known()
    if (agreed || !mine || !other || other <= mine) return true
    agreed = await confirmDialog({
      title: t('Overwrite the newer copy?'),
      message: t(
        'A newer copy of this record was saved at {other} (another tab or window); this tab has the copy saved at {mine}.',
        { other: dateTimeText(new Date(other)), mine: dateTimeText(new Date(mine)) },
      ),
      confirmLabel: t('Overwrite'),
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
 * 'newer' when the user keeps a newer copy, 'skipped' when Save would offer the picker for a kept
 * file that holds records of a kind this version does not know, undefined when the picker was
 * dismissed.
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
}): Promise<
  'newer' | 'skipped' | { name: string; handle?: FileSystemFileHandle | undefined } | undefined
> {
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
  // the picker would let the user pick the kept file and drop those records; Save as still may
  if (!as && holdsSkipped(current)) return 'skipped'
  return saveAs(text, recordFileName(name), ready)
}

/** The file of Open: its one record of `kind`, or the message that says why not. */
async function readOpened<K extends UserRecordKind>(file: File, kind: K) {
  const text = await read(file)
  const parsed: ParsedUserFile =
    text === undefined
      ? { ok: false, reason: tooLargeMessage }
      : await readLoadFile(new TextEncoder().encode(text))
  if (!parsed.ok) {
    const { reason } = parsed
    const problem: Said = ({ t }) =>
      t('{file} not opened: {reason}', { file: file.name, reason: reasonText(reason, t) })
    return { problem }
  }
  const mine = parsed.records.filter((r): r is Of<K> => r.kind === kind)
  const [only] = mine
  if (!only || mine.length !== 1) {
    const problem: Said = ({ t }) =>
      t('{file} holds {count} {kind}; Open takes a file with one, Import takes collections.', {
        file: file.name,
        count: mine.length,
        kind: t(kindNames[kind]),
      })
    return { problem }
  }
  return { parsed, mine: only }
}

/** Stores the opened record and its photo in the browser; false when the user keeps the browser copy. */
async function keepInBrowser(r: UserRecord, files: EmbeddedFile[], t: Translator['t']) {
  const stored = await storedRecord(r.id).catch(() => undefined)
  if (
    stored &&
    canonicalJson(stored.data) !== canonicalJson(r.data) &&
    !(await ask(
      t('Replace the browser copy of {name} with the one in the file?', { name: stored.name }),
      t('Replace'),
    ))
  )
    return false
  await storePhotos(files, [r])
  await putRecords([r])
  return true
}

/** The Import entry once a pick opened it. */
function TablesPage({
  tables,
  ...props
}: { tables: TablesEntry | undefined } & Omit<Parameters<typeof ImportEntry>[0], 'files'>) {
  return tables ? <tables.Entry files={tables.files} {...props} /> : null
}

/** Restores the remembered workspace folder; says so when it was lost. */
function restoreFolderInto(
  setFolder: (folder: { handle: FileSystemDirectoryHandle; allowed: boolean }) => void,
  say: (said: Said) => void,
) {
  restoreFolder()
    .then(async (h) => {
      if (h === 'lost')
        say(plain(msg('The workspace folder could not be restored; choose it again.')))
      else if (h) setFolder({ handle: h, allowed: await folderAllowed(h, false) })
    })
    .catch(() => {})
}

/** The Open menu's Examples section: the page's starting points. */
function ExampleItems({ examples }: { examples: FileMenuItem[] | undefined }) {
  const { t } = useTranslation()
  if (!examples || examples.length === 0) return null
  return (
    <>
      <Menu.Label>{t('Examples')}</Menu.Label>
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
function settled(filling: unknown, snapshot: () => void, say: (said: Said) => void) {
  if (filling instanceof Promise) filling.finally(snapshot).catch((e) => say(() => errorText(e)))
  else snapshot()
}

function BrowserItems({
  shown,
  kind,
  onList,
}: {
  shown: boolean
  kind: Message
  onList: () => void
}) {
  const { t } = useTranslation()
  if (!shown) return null
  return (
    <>
      <Menu.Label>{t('This browser')}</Menu.Label>
      <Menu.Item onClick={onList}>{t('Saved {kind}…', { kind: t(kind) })}</Menu.Item>
    </>
  )
}

function ApiItems({ onDownload, onCopy }: { onDownload: () => void; onCopy: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <Menu.Item onClick={onDownload}>{t('Download for the API')}</Menu.Item>
      <Menu.Item onClick={onCopy}>{t('Copy JSON for the API')}</Menu.Item>
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
  const { t } = useTranslation()
  return (
    <>
      <Menu.Divider />
      <Menu.Label>{t('Workspace folder')}</Menu.Label>
      {folder && !folder.allowed && (
        <Menu.Item onClick={onReconnect}>
          {t('Reconnect folder {name}', { name: folder.handle.name })}
        </Menu.Item>
      )}
      <Menu.Item onClick={onPick}>
        {folder ? t('Change workspace folder…') : t('Choose workspace folder…')}
      </Menu.Item>
      {folder && <Menu.Item onClick={onForget}>{t('Forget workspace folder')}</Menu.Item>}
    </>
  )
}

function FileStatus({
  idle,
  state,
  brief,
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
  /** The state shortened for a page bar; `state` is then the tooltip's text. */
  brief: string | undefined
  /** The workspace folder named after the state, none when it is not in use. */
  folderName: string | undefined
  lines: string
  failure: string
  unsaved: boolean
  autosaved: string | undefined
  kept: string | undefined
}) {
  const { t } = useTranslation()
  const short = useContext(BarStatus) ? brief : undefined
  const folder = folderName ? t(', folder {name}', { name: folderName }) : ''
  const shown = !idle
  return (
    <span className="file-status">
      <span
        className="file-state"
        data-dirty={unsaved || (autosaved && kept === 'failed') || undefined}
        // also after a file is written, when the text is the file's state
        data-saving={(autosaved && kept === 'saving') || undefined}
        data-full={(shown && short && `${state}${folder}`) || undefined}
        aria-live="polite"
      >
        {shown && (short ?? state)}
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
  const tr = useTranslation()
  const { t } = tr
  const said = report.said(tr)
  return (
    <>
      <p>{said.summary}</p>
      {said.invalid && <p>{said.invalid}</p>}
      {said.held && <p>{said.held}</p>}
      {report.skipped.length > 0 && (
        <ul className="file-skipped">
          {report.skipped.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>:{' '}
              <span className="file-reason">{reasonText(s.reason, t)}</span>
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
      {said.conflicts ? (
        <>
          <p>{said.conflicts}</p>
          <Group>
            <Button onClick={onReplace}>{t('Replace')}</Button>
            <Button variant="default" onClick={onClose}>
              {t('Keep browser copies')}
            </Button>
          </Group>
        </>
      ) : (
        <Button onClick={onClose}>{t('Close')}</Button>
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
  kind: Message
  onUse: (record: R) => void
  onDelete: (record: R) => void
  onDeleteAll: () => void
}) {
  const { t } = useTranslation()
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
                {basedOnOf(r)
                  ? t('saved {date}, based on {name}', {
                      date: dateTimeText(new Date(r.saved)),
                      name: parseRef(basedOnOf(r) ?? '')?.id ?? '',
                    })
                  : t('saved {date}', { date: dateTimeText(new Date(r.saved)) })}
              </span>{' '}
              <Button
                variant="subtle"
                color="red"
                size={controlSize.row.button}
                aria-label={t('Delete {name}', { name: r.name })}
                onClick={() => onDelete(r)}
              >
                {t('Delete')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('None yet; Save and Import keep records here.')}</p>
      )}
      {list && list.length > 0 && (
        <Button variant="default" color="red" onClick={onDeleteAll}>
          {t('Delete all {kind}…', { kind: t(kind) })}
        </Button>
      )}
    </>
  )
}

function InvalidItem({ record: r, onDelete }: { record: InvalidRecord; onDelete: () => void }) {
  const { t } = useTranslation()
  return (
    <li>
      <strong>{r.name ?? r.id ?? t('Unnamed record')}</strong>{' '}
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
        {t('Download raw')}
      </Button>{' '}
      <Button variant="subtle" color="red" size={controlSize.row.button} onClick={onDelete}>
        {t('Delete')}
      </Button>
      <pre className="file-error">{r.error}</pre>
    </li>
  )
}

/**
 * The page bar's Open menu (the browser's records, a file, Import, Paste JSON, the page's examples)
 * and Save with its menu (Save as, share link, JSON, Export all, the optional workspace folder).
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
  note?: string | undefined
  /** Why the record cannot be saved, in the page's words; Save then writes nothing. */
  problem?: string | undefined
  /**
   * The name as far as it counts as a change (the workbench): what the user typed, empty for
   * a generated name that follows the data. Renaming then is an unsaved change.
   */
  nameKey?: string
  /** Called after Save, Import or Replace wrote records to the browser store. */
  onStored?: (() => void) | undefined
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
  const tr = useTranslation()
  const { t } = tr
  /** The status line and the failure (announced as an alert), written in the language shown. */
  const [lineSaid, setLineSaid] = useState<Said>()
  const [failureSaid, setFailureSaid] = useState<Said>()
  const setMessage = lineSetter(setLineSaid)
  const setFailure = lineSetter(setFailureSaid)
  const message = shownLine(lineSaid, tr)
  const failure = shownLine(failureSaid, tr)
  const [folder, setFolder] = useState<{ handle: FileSystemDirectoryHandle; allowed: boolean }>()
  const [report, setReport] = useState<Report>()
  const [tables, setTables] = useState<TablesEntry>()
  const openButton = useRef<HTMLButtonElement>(null)
  const [list, setList] = useState<Of<K>[]>()
  /** The invalid browser records the Open menu last found, and the open list of them. */
  const [invalidCount, setInvalidCount] = useState(0)
  const [invalidList, setInvalidList] = useState<InvalidRecord[]>()
  /** Text to copy by hand where the clipboard refused it. */
  const [copyText, setCopyText] = useState<{ title: Message; text: string }>()
  const [pasted, setPasted] = useState<string>()
  /** Said once the browser refuses persistent storage. */
  const [storageNote, setStorageNote] = useState(false)

  // read after hydration: the server has no window
  const [folderApi, setFolderApi] = useState(false)
  useEffect(() => {
    if (!canPickFolder()) return
    setFolderApi(true)
    restoreFolderInto(setFolder, lineSetter(setLineSaid))
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
    save: () => act(msg('Save failed: {error}'), () => save(false))(),
    openFile: () => act(msg('Open failed: {error}'), open)(),
  }
  useShortcuts({
    save: commands.save,
    saveAs: () => act(msg('Save as failed: {error}'), () => save(true))(),
    open: commands.openFile,
  })
  const keyNow = (d: unknown) => keyOf(d, nameKey ?? '')
  const latest = useRef({ unsaved, now, saved, use, openShared, keyNow, t, ...commands })
  latest.current = { unsaved, now, saved, use, openShared, keyNow, t, ...commands }
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
      openSharedLink(
        kind,
        {
          unsaved: () => latest.current.unsaved,
          open: (r, parsed) => latest.current.openShared(r, parsed),
          carry: (r, records) => {
            carriedMakers.current = makerRecordsOf(r, records)
          },
          say: setMessage,
          fail: setFailure,
        },
        latest.current.t,
      ).catch(() => {})
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
          if (next === undefined) settled(filling, snapshot, lineSetter(setLineSaid))
          return true as const
        }
        if (!latest.current.unsaved) return start()
        const { t } = latest.current
        return ask(t('Discard the unsaved changes and start a new record?'), t('Discard')).then(
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
        setLineSaid(undefined)
        setStarted((n) => n + 1)
      },
      rename: (to) => setSaved((s) => s && { ...s, json: renamedKey(s.json, to) }),
    }),
    [],
  )

  // unsaved work: the browser's leave-page prompt, a question before an in-app link or a router
  // push or replace, and a guard history entry with this URL, so Back and Forward ask too
  useEffect(
    () => (unsaved ? guardLeaving(lineSetter(setLineSaid), () => latest.current.t) : undefined),
    [unsaved],
  )

  // an autosaved record is kept in the browser until a file is written
  const state = stateText({ saved, dirty, autosaved, kept, unsaved }, t)
  const ready = folder?.allowed ? folder.handle : undefined
  // in a page bar the state and messages are its status line: one line, the whole text in its tooltip
  const bar = useContext(BarStatus)
  const lines = [message, note, storageNote && t(noStorage)].filter(Boolean).join(' ')
  const status = (
    <FileStatus
      idle={idle}
      state={state.text}
      brief={state.brief}
      folderName={ready?.name}
      lines={lines}
      failure={failure}
      unsaved={unsaved}
      autosaved={autosaved}
      kept={kept}
    />
  )

  /** Runs a file action; a failure is shown (`failed` is its message with `{error}`), not thrown. */
  const act = (failed: Message, f: () => Promise<void>) => () => {
    setMessage()
    setFailure()
    f().catch((e: unknown) => setFailure(({ t }) => t(failed, { error: errorText(e) })))
  }

  /** The record to write and its checked file text; undefined after showing why not. */
  async function prepareSave(as: boolean) {
    if (problem) {
      setFailure(({ t }) => t('Not saved: {reason}', { reason: problem }))
      return
    }
    const recordId = as || !id.current ? newId() : id.current
    const record = { kind, id: recordId, name, saved: new Date().toISOString(), data } as Of<K>
    // a file Open and Import would reject is not written
    const checked = checkedUserDataText(await withMakers(record), await photosOf([record]))
    if (!checked.ok) {
      const { reason } = checked
      setFailure(({ t }) => t('Not saved: {reason}', { reason: reasonText(reason, t) }))
      return
    }
    return { recordId, record, text: checked.text }
  }

  /** Writes the file of a prepared save; undefined when none was written (a newer copy kept, or no file picked). */
  async function writeSave(as: boolean, { recordId, text }: { recordId: string; text: string }) {
    const allow = newerGuard(() => known.current, t)
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
    if (written === 'skipped')
      return setFailure(
        plain(
          msg(
            'Not saved: the opened file holds records of a kind this version does not know, which Save would leave out. Save as writes a new file.',
          ),
        ),
      )
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
    setMessage(plain(msg('Not saved: a newer copy was kept.')))
  }

  /** The browser's copy of a saved record; a failure is shown, the file stays written. */
  async function keepBrowserCopy(record: Of<K>, file: string) {
    try {
      if (!store) await putRecords([record])
      if (!store || (await store(record))) onStored?.()
      void noteStorage()
    } catch (e) {
      setFailure(({ t }) =>
        t('Saved to {file}; the browser copy failed: {error}', { file, error: errorText(e) }),
      )
    }
  }

  /** A shared record: a new id, no file, unsaved until saved. */
  function openShared(record: Of<K>, parsed: ParsedUserFile) {
    onOpen(record.data as Of<K>['data'], record.name, record)
    id.current = undefined
    handle.current = undefined
    known.current = undefined
    setSaved(undefined)
    // not the canonical text of any record: the shared record counts as unsaved work
    initial.current = ''
    setMessage(({ t }) =>
      [t('Opened the shared {name}; Save keeps it.', { name: record.name }), readNote(parsed, t)]
        .filter(Boolean)
        .join(' '),
    )
  }

  /** States once when the browser refuses persistent storage after a write. */
  const noteStorage = () =>
    requestPersistentStorage().then((ok) => {
      if (!ok) setStorageNote(true)
    })

  async function copy(text: string, what: Message) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(({ t, tn }) =>
        tn(
          text.length,
          '{what} copied ({count} character).',
          '{what} copied ({count} characters).',
          { what: t(what) },
        ),
      )
    } catch {
      setCopyText({ title: what, text })
    }
  }

  const current = () =>
    ({ kind, id: id.current ?? newId(), name, saved: new Date().toISOString(), data }) as Of<K>
  useReportOptions(reportOption(reportBox, problem, async () => withMakers(current())))

  async function share() {
    if (problem) return setFailure(({ t }) => t('Not shared: {reason}', { reason: problem }))
    const refused = shareProblem(current())
    if (refused)
      return setFailure(({ t }) => t('Not shared: {reason}', { reason: reasonText(refused, t) }))
    const page = window.location.origin + window.location.pathname
    const link = await shareLink(await withMakers(current()), page)
    if (!link) return setFailure(({ t }) => tooLongText(kind, t))
    await copy(link, msg('Share link'))
  }

  /** The text of the file for the API, none (and the reason shown) when the record cannot be written. */
  function apiText() {
    if (problem || !apiData) {
      setFailure(({ t }) =>
        problem
          ? t('Not written: {reason}', { reason: problem })
          : t('Not written: nothing to write'),
      )
      return
    }
    const checked = checkedUserDataText([{ ...current(), data: apiData }])
    if (checked.ok) return checked.text
    const { reason } = checked
    setFailure(({ t }) => t('Not written: {reason}', { reason: reasonText(reason, t) }))
  }

  async function remove(records: Of<K>[], question: string) {
    if (!records.length || !(await ask(question, t('Delete')))) return
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
    setMessage(({ t }) =>
      t('Deleted {what} from this browser; {rest}.', {
        what:
          records.length === 1
            ? (records[0]?.name ?? '')
            : t('{count} {kind}', { count: records.length, kind: t(kindNames[kind]) }),
        rest: only
          ? t('the page keeps the shown record as unsaved work')
          : t('the page and saved files keep their copies'),
      }),
    )
  }

  async function removeAll() {
    if (!list?.length) return
    // Skip export (or Escape) goes on to the delete question, where Cancel keeps everything
    if (
      (await confirmDialog({
        title: t('Export all records of this browser to a file before deleting?'),
        confirmLabel: t('Export first'),
        cancelLabel: t('Skip export'),
      })) &&
      !(await exportAll())
    )
      return setMessage(plain(msg('Not deleted: the export was not saved.')))
    await remove(
      list,
      t('Delete all {count} {kind} from this browser? This cannot be undone.', {
        count: list.length,
        kind: t(kindNames[kind]),
      }),
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
    if (
      unsaved &&
      !(await ask(t('Replace the unsaved changes with the opened record?'), t('Replace')))
    )
      return false
    const kept = await keepMakers(record, carried)
    await keepLinked(record, carried)
    carriedMakers.current = makerRecordsOf(record, carried)
    const note = kept ? fileNote : [fileNote, t(noMaker)].filter(Boolean).join(' ')
    onOpen(record.data as Of<K>['data'], record.name, record)
    id.current = record.id
    handle.current = opened
    known.current = record.saved
    setSaved({ file, json: keyOf(record.data, record.name) })
    const text = [note, await refsOf([record], t)].filter(Boolean).join(' ')
    if (text) setMessage(({ t }) => t('{file} opened. {text}', { file, text }))
    return true
  }

  async function open() {
    const [picked] = await pickFiles(false, ready)
    if (!picked) return
    const opened = await readOpened(picked.file, kind)
    if ('problem' in opened) {
      setMessage(opened.problem)
      return
    }
    const { parsed, mine } = opened
    // kept in the browser at once, with its photo, as the page keeps every change
    if (autosaved) {
      if (!(await keepInBrowser(mine, parsed.files ?? [], t))) return
      onStored?.()
    }
    // Save writes back only to a file of this record alone; the handle of another file is kept
    // so Save sees at write time whether that file holds records this version would drop
    await use(mine, picked.file.name, picked.handle, readNote(parsed, t), parsed.records)
  }

  /** True when a file was written. */
  async function exportAll() {
    const { records, invalid } = await storedRecords()
    if (!records.length && !invalid.length) {
      setMessage(plain(msg('No records in this browser yet; Save keeps a record here.')))
      return false
    }
    // a plain import() like the data file import's: Export all is one click of the menu
    const { exportAllText, exportNotes } = await import('../lib/data-files.ts')
    const checked = exportAllText(records, await photosOf(records), invalid)
    if (!checked.ok) {
      const { reason } = checked
      setFailure(({ t }) => t('Not exported: {reason}', { reason: reasonText(reason, t) }))
      return false
    }
    const day = localDay(new Date())
    const r = await saveAs(checked.text, `openreloading-data-${day}.json`, ready)
    if (r) {
      setMessage(({ t, tn }) => {
        const notes = exportNotes(records, invalid, checked.left, t, tn)
        return tn(
          records.length,
          'Exported {count} record to {file}. {notes}',
          'Exported {count} records to {file}. {notes}',
          { file: r.name, notes },
        ).trimEnd()
      })
      onExported?.()
    }
    return r !== undefined
  }

  // a plain import() like the Import entry's: the data file import runs only after a pick or a paste
  async function importTexts(files: ImportFile[]) {
    await (await import('../lib/data-files.ts')).importTexts(
      files,
      {
        onStored,
        noteStorage: () => void noteStorage(),
        fail: setFailure,
        show: setReport,
        refs: (added) => refsOf(added, t),
      },
      tr,
    )
  }

  const importData = (files: File[]) =>
    importTexts(
      files.map((file) => ({
        name: file.name,
        read: async () =>
          file.size > maxFileBytes ? undefined : new Uint8Array(await file.arrayBuffer()),
      })),
    )

  async function importFiles() {
    const picked = await pickFiles(true, ready, [...loadFileFormats, ...tableFormats])
    if (!picked.length) return
    // a plain import() after the pick: the picker needs the click's activation, and next/dynamic
    // would count the Import entry in the weight of every route with a File menu
    const { routeImport } = await import('./import-entry.tsx')
    await routeImport(picked, setTables, importData)
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
    const refs = await refsOf(incoming, t)
    setMessage(({ tn }) =>
      tn(
        report.conflicts.length,
        'Replaced {count} browser record. {refs}',
        'Replaced {count} browser records. {refs}',
        { refs },
      ).trimEnd(),
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
    const label = r.name ?? r.id ?? t('Unnamed record')
    if (
      !(await ask(
        t('Delete the invalid record {label} from this browser? This cannot be undone.', { label }),
        t('Delete'),
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
    setMessage(({ t }) => t('Deleted the invalid record {label} from this browser.', { label }))
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
      setMessage(plain(msg('Downloaded the load file for the API.')))
    }
    return Promise.resolve()
  }

  async function copyApi() {
    const text = apiText()
    if (text !== undefined) await copy(text, msg('Load file for the API'))
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
            ref={openButton}
            variant="default"
            leftSection={<FolderOpen aria-hidden="true" />}
            rightSection={<CaretDown size={12} aria-hidden="true" />}
          >
            {t('Open')}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <BrowserItems
            shown={Boolean(onList || browserList || !autosaved)}
            kind={kindNames[kind]}
            onList={onList ?? act(msg('Listing failed: {error}'), browserRecords)}
          />
          {invalidCount > 0 && (
            <Menu.Item onClick={act(msg('Listing failed: {error}'), invalidRecords)}>
              {t('Invalid records ({count})…', { count: invalidCount })}
            </Menu.Item>
          )}
          <Menu.Label>{t('File')}</Menu.Label>
          <Menu.Item onClick={act(msg('Open failed: {error}'), open)} {...keyed('open')}>
            {t('Open file…')}
          </Menu.Item>
          <Menu.Item onClick={act(msg('Import failed: {error}'), importFiles)}>
            {t('Import…')}
          </Menu.Item>
          <Menu.Item onClick={() => setPasted('')}>{t('Paste JSON…')}</Menu.Item>
          <ExampleItems examples={examples} />
        </Menu.Dropdown>
      </Menu>
      <Button.Group className="save-group">
        <Button
          variant="default"
          leftSection={<FloppyDisk aria-hidden="true" />}
          onClick={commands.save}
          title={t('Save ({shortcut})', { shortcut: shortcutLabel('save') })}
          aria-keyshortcuts={shortcutAriaKeys('save')}
        >
          {t('Save')}
        </Button>
        <Menu position="bottom-end" withInitialFocusPlaceholder={false}>
          <Menu.Target>
            <Button variant="default" className="save-more" aria-label={t('Save options')}>
              <CaretDown size={12} aria-hidden="true" />
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={act(msg('Save as failed: {error}'), () => save(true))}
              {...keyed('saveAs')}
            >
              {t('Save as…')}
            </Menu.Item>
            {shareable.includes(kind) && (
              <Menu.Item onClick={act(msg('Share failed: {error}'), share)}>
                {t('Copy share link')}
              </Menu.Item>
            )}
            <Menu.Item
              onClick={act(msg('Copy failed: {error}'), async () =>
                copy(userDataText(await withMakers(current())), msg('Record JSON')),
              )}
            >
              {t('Copy JSON')}
            </Menu.Item>
            {apiData && (
              <ApiItems
                onDownload={act(msg('Download failed: {error}'), downloadApi)}
                onCopy={act(msg('Copy failed: {error}'), copyApi)}
              />
            )}
            <Menu.Divider />
            <Menu.Item
              onClick={act(msg('Export failed: {error}'), async () => {
                await exportAll()
              })}
            >
              {t('Export all…')}
            </Menu.Item>
            {folderApi && (
              <FolderItems
                folder={folder}
                onReconnect={act(msg('Reconnect failed: {error}'), reconnect)}
                onPick={act(msg('Choosing the folder failed: {error}'), pickFolder)}
                onForget={act(msg('Forget failed: {error}'), forget)}
              />
            )}
          </Menu.Dropdown>
        </Menu>
      </Button.Group>
      {inBar(bar, status)}
      <TablesPage
        tables={tables}
        io={{
          importData: (files) => act(msg('Import failed: {error}'), () => importData(files))(),
          onStored,
          noteStorage: () => void noteStorage(),
        }}
        onClose={() => {
          setTables(undefined)
          // the menu item that opened it is gone: Open, or Page actions below 75em
          focusBack(openButton.current, '.page-bar .page-bar-toggle')
        }}
      />
      <AppModal
        opened={report !== undefined}
        onClose={() => setReport(undefined)}
        title={t('Import')}
      >
        {report && (
          <ImportReport
            report={report}
            onClose={() => setReport(undefined)}
            onReplace={act(msg('Replace failed: {error}'), replace)}
          />
        )}
      </AppModal>
      <AppModal
        opened={list !== undefined}
        onClose={() => setList(undefined)}
        title={t('Saved {kind} in this browser', { kind: t(kindNames[kind]) })}
      >
        <SavedList
          list={list}
          kind={kindNames[kind]}
          onUse={async (r) => {
            if (await use(r, `${r.name} (browser)`)) setList(undefined)
          }}
          onDelete={(r) =>
            act(msg('Delete failed: {error}'), () =>
              remove(
                [r],
                t('Delete {name} from this browser? This cannot be undone.', { name: r.name }),
              ),
            )()
          }
          onDeleteAll={act(msg('Delete all failed: {error}'), removeAll)}
        />
      </AppModal>
      <AppModal
        opened={invalidList !== undefined}
        onClose={() => setInvalidList(undefined)}
        title={t('Invalid records in this browser')}
      >
        <p>
          {t(
            'These records do not pass the current format. They stay in this browser, are not shown elsewhere and are in Export all as stored, which Import restores as invalid records.',
          )}
        </p>
        <ul className="file-records">
          {invalidList?.map((r) => (
            <InvalidItem
              key={String((r.raw as { id?: unknown } | null)?.id)}
              record={r}
              onDelete={act(msg('Delete failed: {error}'), () => removeInvalid(r))}
            />
          ))}
        </ul>
      </AppModal>
      <AppModal
        opened={copyText !== undefined}
        onClose={() => setCopyText(undefined)}
        title={t('{what}: copy it by hand', { what: copyText ? t(copyText.title) : '' })}
      >
        <Textarea
          label={t('The clipboard is not available here')}
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
        title={t('Paste JSON')}
      >
        <Textarea
          label={t('User data file text')}
          description={t('Checked as Import checks a file.')}
          autosize
          minRows={4}
          maxRows={12}
          value={pasted ?? ''}
          onChange={(e) => setPasted(e.currentTarget.value)}
        />
        <Group mt="sm">
          <Button
            disabled={!pasted?.trim()}
            onClick={act(msg('Paste failed: {error}'), async () => {
              const text = pasted ?? ''
              setPasted(undefined)
              await importTexts([
                { name: t('Pasted text'), read: async () => new TextEncoder().encode(text) },
              ])
            })}
          >
            {t('Import')}
          </Button>
        </Group>
      </AppModal>
    </Group>
  )
}

/** Open and Save disabled, in their place until a page's record exists. */
export function FileMenuPlaceholder() {
  const { t } = useTranslation()
  return (
    <Group gap="xs" className="file-menu">
      <Button
        variant="default"
        disabled
        leftSection={<FolderOpen aria-hidden="true" />}
        rightSection={<CaretDown size={12} aria-hidden="true" />}
      >
        {t('Open')}
      </Button>
      <Button.Group className="save-group">
        <Button variant="default" disabled leftSection={<FloppyDisk aria-hidden="true" />}>
          {t('Save')}
        </Button>
        <Button variant="default" disabled className="save-more" aria-label={t('Save options')}>
          <CaretDown size={12} aria-hidden="true" />
        </Button>
      </Button.Group>
    </Group>
  )
}

/** Memoized: pages pass deferred data and a stable `onOpen`, so an edit renders the menu later. */
export const FileMenu = memo(FileMenuOf) as typeof FileMenuOf
