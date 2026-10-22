'use client'

import { Combobox, Loader, TextInput, type TextInputProps, useCombobox } from '@mantine/core'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api-fetch.ts'
import type { ListOf } from '../lib/api-types.ts'

type State<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; items: T[]; total: number }
  | { status: 'error' }

/** The API search of one record kind through `apiFetch`; `params` such as `&cartridge=308-win`. */
export async function searchRecords<T>(
  kind: string,
  text: string,
  limit: number,
  params: string,
  signal: AbortSignal,
): Promise<ListOf<T>> {
  const res = await apiFetch(`${kind}?q=${encodeURIComponent(text)}&limit=${limit}${params}`, {
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as ListOf<T>
}

/**
 * Search box over the API list of `kind` (`apiFetch`), 300 ms after the last keystroke; the
 * previous request is aborted. Matches open in a list box: arrow keys move, Enter or a click chooses;
 * Enter with no match highlighted chooses the only one.
 */
export function RecordSearch<T extends { id: string }>({
  kind,
  label,
  describe,
  onSelect,
  noneText,
  unreachableText,
  params = '',
  chosen,
  picked,
  extra = [],
  onExtra,
  size,
  chevron = false,
}: {
  kind: 'bullets' | 'cartridges' | 'powders'
  label: string
  describe: (item: T) => string
  onSelect: (item: T) => void
  noneText: string
  unreachableText: string
  /** Extra query parameters, for example `&cartridge=308-win`. */
  params?: string
  /**
   * The chosen record, or the picker's prompt: a compact picker with a search icon, the
   * label left to screen readers, this text in the empty field.
   */
  chosen?: string
  /** `chosen` names a record, not the prompt: drawn in the text colour. */
  picked?: boolean
  /** Local options listed first, matched by the typed text, such as the browser's bullet designs. */
  extra?: { id: string; label: string }[]
  onExtra?: (id: string) => void
  /** The field's size of the scale (`controlSize` in `theme.ts`); the theme's default without it. */
  size?: TextInputProps['size']
  /** Drawn as a select: a chevron at the end, no search icon. */
  chevron?: boolean
}) {
  const [q, setQ] = useState('')
  const [state, setState] = useState<State<T>>({ status: 'idle' })
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() })

  const shownParams = useRef(params)

  useEffect(() => {
    // matches of other params (for example another diameter) must not stay choosable
    if (shownParams.current !== params) {
      shownParams.current = params
      setState({ status: 'idle' })
    }
    const text = q.trim()
    if (text.length < 2) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState({ status: 'loading' })
      try {
        const body = await searchRecords<T>(kind, text, 20, params, controller.signal)
        setState({ status: 'ok', items: body.items, total: body.total })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, kind, params])

  const items = state.status === 'ok' ? state.items : []
  const typed = q.trim().toLowerCase()
  const local = extra.filter((e) => e.label.toLowerCase().includes(typed))
  let message = ''
  if (state.status === 'loading') message = 'Searching'
  else if (state.status === 'error') message = unreachableText
  else if (state.status === 'ok')
    message =
      items.length === 0
        ? noneText
        : `${state.total} found${state.total > items.length ? `, first ${items.length} shown` : ''}`

  const submit = (id: string) => {
    if (id.startsWith('extra:')) onExtra?.(id.slice('extra:'.length))
    const item = items.find((i) => i.id === id)
    if (item) onSelect(item)
    setQ('')
    combobox.closeDropdown()
  }
  const shown = [...local.map((e) => `extra:${e.id}`), ...items.map((i) => i.id)]

  return (
    <div className="search" data-picked={picked || undefined}>
      <Combobox store={combobox} onOptionSubmit={submit}>
        <Combobox.Target withExpandedAttribute>
          <TextInput
            size={size}
            label={label}
            labelProps={chosen === undefined ? undefined : { className: 'visually-hidden' }}
            placeholder={chosen}
            leftSection={
              chosen === undefined || chevron ? undefined : (
                <MagnifyingGlass size={16} aria-hidden="true" />
              )
            }
            autoComplete="off"
            value={q}
            rightSection={
              state.status === 'loading' ? (
                <Loader size="xs" />
              ) : chevron ? (
                <Combobox.Chevron />
              ) : undefined
            }
            rightSectionPointerEvents="none"
            onChange={(e) => {
              setQ(e.currentTarget.value)
              combobox.openDropdown()
            }}
            onClick={() => combobox.openDropdown()}
            onBlur={() => combobox.closeDropdown()}
            // Enter chooses the highlighted match, else the only one; it must not submit the form.
            // Ctrl+Enter (Cmd+Enter) stays free for the calculator's run shortcut.
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
              e.preventDefault()
              if (shown.length === 1 && combobox.getSelectedOptionIndex() === -1) submit(shown[0])
            }}
          />
        </Combobox.Target>
        <Combobox.Dropdown hidden={items.length === 0 && local.length === 0}>
          <Combobox.Options aria-label="Matches" mah={280} style={{ overflowY: 'auto' }}>
            {local.map((e) => (
              <Combobox.Option value={`extra:${e.id}`} key={`extra:${e.id}`}>
                {e.label}
              </Combobox.Option>
            ))}
            {items.map((item) => (
              <Combobox.Option value={item.id} key={item.id}>
                {describe(item)}
              </Combobox.Option>
            ))}
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
      <p role="status" className="search-status">
        {message}
      </p>
    </div>
  )
}
