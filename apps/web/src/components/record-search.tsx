'use client'

import {
  ActionIcon,
  CloseButton,
  Combobox,
  Group,
  Loader,
  TextInput,
  type TextInputProps,
  useCombobox,
} from '@mantine/core'
import { ListMagnifyingGlass, MagnifyingGlass } from '@phosphor-icons/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Translator } from '../i18n/translate.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import type { ListOf } from '../lib/api-types.ts'

type ApiKind = 'bullets' | 'cartridges' | 'powders'

/** The matches of a list in the browser, 20 at most with the total. */
type Find<T> = (text: string, limit: number) => Promise<ListOf<T>>

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

/** The matches of the typed text: from `find`, else the API; a first key that finds nothing stays quiet. */
async function matches<T>(
  kind: ApiKind | undefined,
  text: string,
  params: string,
  find: Find<T> | undefined,
  signal: AbortSignal,
): Promise<State<T>> {
  // the props give `kind` whenever they give no `find`
  const body = await (find?.(text, 20) ??
    searchRecords<T>(kind as ApiKind, text, 20, params, signal))
  if (text.length < 2 && body.items.length === 0) return { status: 'idle' }
  return { status: 'ok', items: body.items, total: body.total }
}

/** The status line under the field: what the search is doing or found. */
function statusLine<T>(
  state: State<T>,
  typed: boolean,
  noneText: string,
  unreachableText: string,
  t: Translator['t'],
) {
  if (state.status === 'loading') return t('Searching')
  if (state.status === 'error') return unreachableText
  if (state.status !== 'ok' || !typed) return ''
  if (state.items.length === 0) return noneText
  return state.total > state.items.length
    ? t('{total} found, first {shown} shown', { total: state.total, shown: state.items.length })
    : t('{total} found', { total: state.total })
}

/** The end of the field: the clear and browse buttons, else the loader, else the select's chevron. */
function endSection({
  loading,
  browse,
  clear,
  chevron,
  size,
  onBrowse,
}: {
  loading: boolean
  browse: { label: string } | undefined
  clear: { label: string; onClear: () => void } | undefined
  chevron: boolean
  size: TextInputProps['size']
  onBrowse: () => void
}): ReactNode {
  if (browse)
    return (
      <Group gap={4} wrap="nowrap">
        {loading && <Loader size="xs" />}
        {/* a 24 px target (WCAG 2.5.8) */}
        {clear && <CloseButton size={24} aria-label={clear.label} onClick={clear.onClear} />}
        <ActionIcon
          variant="subtle"
          size={size === 'xs' ? 'input-xs' : 'input-sm'}
          aria-label={browse.label}
          onClick={onBrowse}
        >
          <ListMagnifyingGlass size={16} aria-hidden="true" />
        </ActionIcon>
      </Group>
    )
  if (loading) return <Loader size="xs" />
  return chevron ? <Combobox.Chevron /> : undefined
}

/**
 * Search box over the API list of `kind` (`apiFetch`), 300 ms after the last keystroke; the
 * previous request is aborted. With `find` the matches come from it instead, without the pause. Matches open in a list box: arrow keys move, Enter or a click chooses;
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
  browse,
  clear,
  find,
}: {
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
  chosen?: string | undefined
  /** `chosen` names a record, not the prompt: drawn in the text colour. */
  picked?: boolean
  /** Local options listed first, matched by the typed text, such as the browser's bullet designs. */
  extra?: { id: string; label: string }[]
  onExtra?: (id: string) => void
  /** The field's size of the scale (`controlSize` in `theme.ts`); the theme's default without it. */
  size?: TextInputProps['size']
  /** Drawn as a select: a chevron at the end, no search icon. */
  chevron?: boolean
  /** A button at the end of the field that opens a browsing dialog with the typed text. */
  browse?: { label: string; onOpen: (typed: string) => void }
  /** A button beside `browse` that clears the choice, shown while `picked`. */
  clear?: { label: string; onClear: () => void } | undefined
} & (
  | { kind: ApiKind; find?: Find<T> }
  /** The matches of the typed text in place of the API search. */
  | { kind?: undefined; find: Find<T> }
)) {
  const { t } = useTranslation()
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
    if (text.length < 2 && !find) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(
      async () => {
        // a first key lists what `find` has for it; with nothing, the field stays quiet
        if (text.length >= 2) setState({ status: 'loading' })
        try {
          const next = await matches<T>(kind, text, params, find, controller.signal)
          if (!controller.signal.aborted) setState(next)
        } catch {
          if (!controller.signal.aborted) setState({ status: 'error' })
        }
      },
      find ? 0 : 300,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, kind, params, find])

  const items = state.status === 'ok' ? state.items : []
  const typed = q.trim().toLowerCase()
  const local = extra.filter((e) => e.label.toLowerCase().includes(typed))
  const message = statusLine(state, q.trim() !== '', noneText, unreachableText, t)

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
            {...(size !== undefined && { size })}
            label={label}
            {...(chosen !== undefined && {
              labelProps: { className: 'visually-hidden' },
              placeholder: chosen,
            })}
            {...(chosen !== undefined &&
              !chevron && { leftSection: <MagnifyingGlass size={16} aria-hidden="true" /> })}
            autoComplete="off"
            value={q}
            rightSection={endSection({
              loading: state.status === 'loading',
              browse,
              clear: picked ? clear : undefined,
              chevron,
              size,
              onBrowse: () => {
                // the typed text moves into the dialog
                browse?.onOpen(q)
                setQ('')
              },
            })}
            rightSectionPointerEvents={browse ? 'all' : 'none'}
            // the clear button beside the browse button
            {...(browse && picked && clear && { rightSectionWidth: size === 'xs' ? 58 : 64 })}
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
              const [only] = shown
              if (
                only !== undefined &&
                shown.length === 1 &&
                combobox.getSelectedOptionIndex() === -1
              )
                submit(only)
            }}
          />
        </Combobox.Target>
        <Combobox.Dropdown hidden={items.length === 0 && local.length === 0}>
          <Combobox.Options aria-label={t('Matches')} mah={280} style={{ overflowY: 'auto' }}>
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

/**
 * A picker's chooser dialog: opened with the field's text, the focus back on its opener when it
 * closes, since a dialog opened before its code has loaded mounts open and cannot return it itself.
 */
export function useChooser() {
  const [dialog, setDialog] = useState({ text: '', opened: false })
  const opener = useRef<HTMLElement | null>(null)
  return {
    ...dialog,
    open: (text: string) => {
      opener.current = document.activeElement as HTMLElement | null
      setDialog({ text, opened: true })
    },
    close: () => {
      setDialog((d) => ({ ...d, opened: false }))
      setTimeout(() => opener.current?.focus())
    },
  }
}
