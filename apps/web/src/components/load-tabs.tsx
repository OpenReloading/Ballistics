'use client'

import { ActionIcon, Button, Popover } from '@mantine/core'
import { CaretDown, Check, FolderOpen, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
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
  const { t } = useTranslation()
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
  const index = items.findIndex((tb) => tb.active)
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
              aria-label={
                shown?.unsaved
                  ? t('Load {n}: {label}, unsaved changes, switch load ({count} open)', {
                      n: index + 1,
                      label,
                      count: items.length,
                    })
                  : t('Load {n}: {label}, switch load ({count} open)', {
                      n: index + 1,
                      label,
                      count: items.length,
                    })
              }
              // WCAG 2.5.3: the name holds the visible number and label as two words (the space after the number)
              title={shown?.title}
              aria-haspopup="dialog"
              aria-expanded={menu}
              data-unsaved={shown?.unsaved || undefined}
              data-due={due || undefined}
              leftSection={
                <span className="load-index" aria-hidden="true">
                  {index + 1}{' '}
                </span>
              }
              rightSection={<CaretDown size={12} aria-hidden="true" />}
              onClick={() => setMenu((o) => !o)}
            >
              {label}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <ul className="load-menu" aria-label={t('All open loads')}>
              {items.map((tb) => (
                <li key={tb.key} className="load-row" data-active={tb.active || undefined}>
                  <button
                    type="button"
                    className="load-row-name"
                    aria-current={tb.active ? 'true' : undefined}
                    title={tb.title}
                    onClick={() => {
                      setMenu(false)
                      onSwitch(tb.key)
                    }}
                  >
                    <span className="load-row-check" aria-hidden="true">
                      {tb.active && <Check size={14} weight="bold" />}
                    </span>
                    <span className="load-row-title">{tb.title}</span>
                    {tb.unsaved && (
                      <>
                        <span className="load-row-dot" aria-hidden="true" />
                        <span className="visually-hidden">{t(', unsaved changes')}</span>
                      </>
                    )}
                  </button>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="load-close"
                      aria-label={t('Close {title}', { title: tb.title })}
                      onClick={() => {
                        // the question about unsaved changes is a dialog: the menu gives way
                        if (tb.unsaved) setMenu(false)
                        onClose(tb.key)
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
                {t('Rename this load')}
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
                {t('Saved loads')}
              </Button>
            </div>
          </Popover.Dropdown>
        </AppPopover>
        {editing && (
          <input
            ref={field}
            className="load-edit"
            aria-label={t('Load name')}
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
      <ActionIcon
        variant="default"
        aria-label={t('New load')}
        title={t('New load')}
        onClick={onNew}
      >
        <Plus size={18} aria-hidden="true" />
      </ActionIcon>
    </div>
  )
}
