'use client'

import { ActionIcon, Button, Popover } from '@mantine/core'
import { CaretDown, Check, FolderOpen, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { controlSize } from '../lib/theme.ts'
import { AppPopover } from './app-popover.tsx'

type LoadTabItem = { key: string; title: string; active: boolean; unsaved: boolean }

/**
 * The workbench's open loads: one switcher button (the shown load's number and short name, a dot
 * for unsaved changes) whose menu lists every open load (name, unsaved dot, check mark on the shown
 * one, Close), then Rename and Saved loads; a button for a new load beside it. Rename edits the
 * name in place: the field covers the switcher, so nothing moves; an empty name is the generated one.
 */
export function LoadTabs({
  items,
  label,
  onSwitch,
  onClose,
  onNew,
  onList,
  due,
  name,
  generated,
  onRename,
}: {
  items: LoadTabItem[]
  /** The shown load's short name on the switcher; the full name is its title. */
  label: string
  onSwitch: (key: string) => void
  onClose: (key: string) => void
  onNew: () => void
  onList: () => void
  /** The export reminder is due. */
  due: boolean
  /** The shown load's name, and the generated one it falls back to. */
  name: string
  generated: string
  /** The typed name as it changes; undefined: the generated name. */
  onRename: (name: string | undefined) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const switcher = useRef<HTMLButtonElement>(null)
  /** The name before the edit, which Escape puts back. */
  const before = useRef<{ custom: boolean; name: string }>(undefined)
  useEffect(() => {
    if (editing) field.current?.select()
  }, [editing])
  /** The unmounted field may blur once more: the edit ends once. */
  const open = useRef(false)
  const finish = (keep: boolean) => {
    if (!open.current) return
    open.current = false
    if (!keep && before.current) onRename(before.current.custom ? before.current.name : undefined)
    else if (draft.trim() !== draft || !draft.trim()) onRename(draft.trim() || undefined)
    setEditing(false)
    switcher.current?.focus()
  }
  const index = items.findIndex((t) => t.active)
  const shown = items[index]
  const [menu, setMenu] = useState(false)
  // another load is shown: the edit of the earlier one is over
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a change of the shown load
  useEffect(() => {
    open.current = false
    setEditing(false)
  }, [shown?.key])
  return (
    <div className="load-strip">
      <div className="load-switch-wrap">
        <AppPopover opened={menu} onChange={setMenu} position="bottom-start" trapFocus>
          <Popover.Target>
            <Button
              ref={switcher}
              variant="default"
              className="load-switch"
              aria-label={`${label}, open loads, ${index + 1} of ${items.length}${shown?.unsaved ? ', unsaved changes' : ''}`}
              title={shown?.title}
              aria-haspopup="dialog"
              aria-expanded={menu}
              data-unsaved={shown?.unsaved || undefined}
              data-due={due || undefined}
              leftSection={
                <span className="load-index" aria-hidden="true">
                  {index + 1}
                </span>
              }
              rightSection={<CaretDown size={12} aria-hidden="true" />}
              onClick={() => setMenu((o) => !o)}
            >
              {label}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <ul className="load-menu" aria-label="All open loads">
              {items.map((t) => (
                <li key={t.key} className="load-row" data-active={t.active || undefined}>
                  <button
                    type="button"
                    className="load-row-name"
                    aria-current={t.active ? 'true' : undefined}
                    title={t.title}
                    onClick={() => {
                      setMenu(false)
                      onSwitch(t.key)
                    }}
                  >
                    <span className="load-row-check" aria-hidden="true">
                      {t.active && <Check size={14} weight="bold" />}
                    </span>
                    <span className="load-row-title">{t.title}</span>
                    {t.unsaved && (
                      <>
                        <span className="load-row-dot" aria-hidden="true" />
                        <span className="visually-hidden">, unsaved changes</span>
                      </>
                    )}
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="load-close"
                      aria-label={`Close ${t.title}`}
                      onClick={() => {
                        // the question about unsaved changes is a dialog: the menu gives way
                        if (t.unsaved) setMenu(false)
                        onClose(t.key)
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="load-menu-actions">
              <Button
                variant="subtle"
                size={controlSize.row.button}
                leftSection={<PencilSimple size={14} aria-hidden="true" />}
                onClick={() => {
                  setMenu(false)
                  before.current = { custom: name !== generated, name }
                  open.current = true
                  setDraft(name)
                  setEditing(true)
                }}
              >
                Rename this load
              </Button>
              <Button
                variant="subtle"
                size={controlSize.row.button}
                leftSection={<FolderOpen size={14} aria-hidden="true" />}
                aria-haspopup="dialog"
                data-due={due || undefined}
                onClick={() => {
                  setMenu(false)
                  onList()
                }}
              >
                Saved loads
              </Button>
            </div>
          </Popover.Dropdown>
        </AppPopover>
        {editing && (
          <input
            ref={field}
            className="load-edit"
            aria-label="Load name"
            placeholder={generated}
            maxLength={200}
            value={draft}
            onChange={(e) => {
              setDraft(e.currentTarget.value)
              onRename(e.currentTarget.value)
            }}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finish(true)
              else if (e.key === 'Escape') {
                e.stopPropagation()
                finish(false)
              }
            }}
          />
        )}
        {/* the whole name on paper */}
        <span className="print-only">{shown?.title}</span>
      </div>
      <ActionIcon variant="default" aria-label="New load" title="New load" onClick={onNew}>
        <Plus size={18} aria-hidden="true" />
      </ActionIcon>
    </div>
  )
}
