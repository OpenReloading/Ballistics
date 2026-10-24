'use client'

import type { Load } from '@openreloading/schema'
import { useEffect, useRef, useState } from 'react'
import {
  type LoadRecord,
  openLoadsKey,
  openLoadsText,
  parseOpenLoads,
  tabAfterClose,
  tabTitles,
} from '../lib/load-tabs.ts'
import { linkParams } from '../lib/query.ts'
import { namedKey, renamedKey } from '../lib/user-data.ts'
import { storedRecords } from '../lib/user-store.ts'
import { confirmDialog } from './confirm.tsx'
import type { FileState } from './file-menu.tsx'
import type { UseWorkbenchStateResult } from './use-workbench-load.ts'

/**
 * One open load. The shown tab is the live workbench; its entry here is the one it was
 * installed from. Every other entry is a snapshot: the load, its shown result and the File menu's
 * state, which `install` puts back.
 */
type Tab = {
  key: string
  /** The saved record the tab was installed from, if any. */
  recordId?: string
  title: string
  /** The name the user typed or the record carries; undefined: the generated name. */
  custom?: string
  /** Undefined: a load with nothing chosen or typed, restored by `reset()`. */
  data?: Load
  outcome?: UseWorkbenchStateResult['outcome']
  changed: boolean
  file?: FileState
  unsaved: boolean
}

let counter = 0
const newKey = () => `tab-${++counter}`
const blank = (): Tab => ({ key: newKey(), title: 'New load', changed: false, unsaved: false })

/** A saved load as an installable tab: its file state reads "<name> (browser)", as a saved record of the Open menu. */
const savedTab = (r: LoadRecord): Tab => ({
  key: newKey(),
  recordId: r.id,
  title: r.name,
  custom: r.name,
  data: r.data,
  changed: false,
  unsaved: false,
  file: {
    id: r.id,
    known: r.saved,
    saved: { file: `${r.name} (browser)`, json: namedKey(r.data, r.name) },
    unsaved: false,
  },
})

/** Whether the URL asks for a load of its own, which then is the shown one. */
const urlAsksForLoad = () =>
  window.location.search !== '' ||
  window.location.hash.startsWith('#record=') ||
  linkParams(window.location).has('units')

/** The open loads: the tabs, switching, opening saved loads and the stored open set. */
export function useLoadTabs(load: UseWorkbenchStateResult) {
  const [tabs, setTabs] = useState<Tab[]>(() => [blank()])
  const [active, setActive] = useState(() => tabs[0].key)
  /** Whether the shown load has unsaved changes (the File menu reports it). */
  const [unsaved, setUnsaved] = useState(false)
  const [restored, setRestored] = useState(false)
  const fileId = load.fileMenu.current?.id()
  const live = useRef({ load, tabs, active, unsaved })
  live.current = { load, tabs, active, unsaved }

  const titles = tabTitles(tabs.map((t) => (t.key === active ? load.name : t.title)))

  /** The shown tab as a snapshot. */
  function snapshot(): Tab {
    const { load, tabs, active, unsaved } = live.current
    const menu = load.fileMenu.current
    const t = tabs.find((x) => x.key === active) ?? tabs[0]
    return {
      key: t.key,
      recordId: menu?.id(),
      title: load.name,
      custom: load.customName,
      data: load.fresh ? undefined : load.fileData,
      outcome: load.outcome,
      changed: load.changed,
      file: menu?.snapshot(),
      unsaved,
    }
  }

  /** Puts `tab` on the workbench: its load, its File menu state and its result. */
  function install(tab: Tab) {
    const { load } = live.current
    if (tab.data) load.onOpenFile(tab.data, tab.custom)
    else load.reset()
    load.fileMenu.current?.restore(tab.file ?? { unsaved: false })
    load.restoreResult(tab.outcome, tab.changed)
    setActive(tab.key)
    setUnsaved(tab.unsaved)
  }

  const replace = (ts: Tab[], tab: Tab) => ts.map((t) => (t.key === tab.key ? tab : t))

  function switchTo(key: string) {
    const target = live.current.tabs.find((t) => t.key === key)
    if (!target || key === live.current.active) return
    const current = snapshot()
    setTabs((ts) => replace(ts, current))
    install(target)
  }

  /** Adds `tab` and shows it; a shown load with nothing in it is replaced instead. */
  function add(tab: Tab) {
    const { load, unsaved, active } = live.current
    const current = snapshot()
    const empty = load.fresh && !unsaved && !current.recordId
    setTabs((ts) => (empty ? ts.filter((t) => t.key !== active) : replace(ts, current)).concat(tab))
    install(tab)
  }

  const newTab = () => add(blank())

  /** A saved load: its own tab, or that tab when it is open. */
  function openRecord(record: LoadRecord) {
    const { tabs, active, load } = live.current
    const open = tabs.find((t) =>
      t.key === active ? load.fileMenu.current?.id() === record.id : t.recordId === record.id,
    )
    if (open) return switchTo(open.key)
    add(savedTab(record))
  }

  async function close(key: string) {
    const { tabs, active, unsaved } = live.current
    const tab = tabs.find((t) => t.key === key)
    if (!tab || tabs.length < 2) return
    const isUnsaved = key === active ? unsaved : tab.unsaved
    if (
      isUnsaved &&
      !(await confirmDialog({
        title: `Close ${titles[tabs.indexOf(tab)]}? Its unsaved changes are lost.`,
        confirmLabel: 'Close',
        danger: true,
      }))
    )
      return
    const keys = live.current.tabs.map((t) => t.key)
    if (key !== live.current.active) return setTabs((ts) => ts.filter((t) => t.key !== key))
    const next = live.current.tabs.find((t) => t.key === tabAfterClose(keys, key))
    if (!next) return
    setTabs((ts) => ts.filter((t) => t.key !== key))
    install(next)
  }

  /** A saved load was deleted from the browser: its tab goes, or the shown load becomes unsaved work. */
  function deleted(id: string) {
    setTabs((ts) => ts.filter((t) => t.key === live.current.active || t.recordId !== id))
    const menu = live.current.load.fileMenu.current
    if (menu?.id() === id) menu.restore({ initial: '', unsaved: true })
  }

  /** A saved load was renamed in the list: the tab that holds it takes the name, the name is no change. */
  function renamed(id: string, name: string) {
    const { load, active } = live.current
    const menu = load.fileMenu.current
    if (menu?.id() === id) {
      load.setCustomName(name)
      menu.rename(name)
    }
    setTabs((ts) =>
      ts.map((t) => {
        if (t.key === active || t.recordId !== id) return t
        const saved = t.file?.saved
        return {
          ...t,
          title: name,
          custom: name,
          file: t.file && {
            ...t.file,
            saved: saved && { ...saved, json: renamedKey(saved.json, name) },
          },
        }
      }),
    )
  }

  // a record opened into the shown tab (File menu) leaves no second tab for it
  useEffect(() => {
    if (!fileId) return
    setTabs((ts) =>
      ts.some((t) => t.key !== active && t.recordId === fileId)
        ? ts.filter((t) => t.key === active || t.recordId !== fileId)
        : ts,
    )
  }, [fileId, active])

  // the open set of saved loads, reopened on the next visit
  useEffect(() => {
    if (!restored) return
    const ids = tabs.flatMap((t) => {
      const id = t.key === active ? fileId : t.recordId
      return id ? [id] : []
    })
    try {
      localStorage.setItem(
        openLoadsKey,
        openLoadsText({ ids, active: fileId && ids.includes(fileId) ? fileId : undefined }),
      )
    } catch {}
  }, [restored, tabs, active, fileId])

  // reload and close ask while a load behind the shown one has unsaved changes
  const behind = tabs.some((t) => t.key !== active && t.unsaved)
  useEffect(() => {
    if (!behind) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [behind])

  // the saved loads of the last visit: the stored one shown when the URL asks for nothing
  // biome-ignore lint/correctness/useExhaustiveDependencies: once on mount
  useEffect(() => {
    let alive = true
    // read now: the share link removes its fragment soon after mounting
    const asks = urlAsksForLoad()
    let stored = parseOpenLoads(null)
    try {
      stored = parseOpenLoads(localStorage.getItem(openLoadsKey))
    } catch {}
    storedRecords()
      .then(({ records }) => {
        if (!alive) return
        const saved = stored.ids.flatMap((id) => {
          const r = records.find((x): x is LoadRecord => x.kind === 'load' && x.id === id)
          return r ? [savedTab(r)] : []
        })
        const shownNow = saved.find((t) => t.recordId === stored.active)
        const { load, unsaved, tabs } = live.current
        const untouched =
          load.fresh && !unsaved && tabs.length === 1 && !load.fileMenu.current?.id()
        if (saved.length > 0) {
          if (shownNow && untouched && !asks) {
            setTabs(saved)
            install(shownNow)
          } else setTabs((ts) => [...ts, ...saved])
        }
        setRestored(true)
      })
      .catch(() => setRestored(true))
    return () => {
      alive = false
    }
  }, [])

  return {
    items: tabs.map((t, i) => ({
      key: t.key,
      title: titles[i],
      active: t.key === active,
      unsaved: t.key === active ? unsaved : t.unsaved,
    })),
    close,
    deleted,
    renamed,
    rename: load.setCustomName,
    generated: load.generated,
    newTab,
    openRecord,
    setUnsaved,
    switchTo,
    openIds: tabs.flatMap((t) => {
      const id = t.key === active ? fileId : t.recordId
      return id ? [id] : []
    }),
  }
}
