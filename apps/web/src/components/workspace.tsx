'use client'

import { Button, Tabs } from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { Check, LinkSimple } from '@phosphor-icons/react'
import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { useScrollFocus } from './scroll-region.tsx'

export type WorkspaceHandle = {
  /** Opens the Inputs tab; call it inside `flushSync` to focus a field right after. */
  showInputs: () => void
  /** Opens the phone Range tab. */
  showRange: () => void
}

/**
 * Calculator frame: inputs and results (the page's actions are in its `PageBar`). Below 48em the two are tabs with a readout
 * bar under the inputs; from 48em CSS hides the tab list and shows both panels, side by side from
 * 62em (`globals.css`).
 */
export function Workspace({
  inputs,
  results,
  range,
  bar,
  ref,
  inputsLabel = 'Inputs',
  className,
}: {
  inputs: ReactNode
  results: ReactNode
  /** A third tab below 48em, the phone range view; mounted while its tab is open. */
  range?: ReactNode | undefined
  /** Readout bar of the phone layout, under the inputs and the results; `show` opens the Results tab and focuses it. */
  bar: (show: () => void) => ReactNode
  ref?: Ref<WorkspaceHandle> | undefined
  /** Name of the inputs tab below 48em. */
  inputsLabel?: string | undefined
  className?: string | undefined
}) {
  const [tab, setTab] = useState('inputs')
  useImperativeHandle(
    ref,
    () => ({ showInputs: () => setTab('inputs'), showRange: () => setTab('range') }),
    [],
  )
  // from 48em both panels show and the tab list is gone: a Range tab left open would hide
  useEffect(() => {
    if (!range) return
    const wide = matchMedia('(min-width: 48em)')
    const leave = () => wide.matches && setTab((t) => (t === 'range' ? 'inputs' : t))
    wide.addEventListener('change', leave)
    return () => wide.removeEventListener('change', leave)
  }, [range])
  const region = useRef<HTMLElement>(null)
  const scrollFocus = useScrollFocus('Results', region)
  const show = useCallback(() => {
    flushSync(() => setTab('results'))
    region.current?.focus()
  }, [])
  // from the "Skip to results" link of the layout; handled, so the link stays on the page
  useEffect(() => {
    const onShow = (e: Event) => {
      e.preventDefault()
      show()
    }
    window.addEventListener('show-results', onShow)
    // the link was pressed before this listener existed, or the page was opened at #results;
    // out of the effect, as `flushSync` does not flush inside one
    const frame = window.location.hash === '#results' ? requestAnimationFrame(show) : undefined
    return () => {
      window.removeEventListener('show-results', onShow)
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [show])
  return (
    <div className={className ? `workspace ${className}` : 'workspace'}>
      <Tabs value={tab} onChange={(v) => setTab(v ?? 'inputs')} className="workspace-tabs">
        <Tabs.List grow className="workspace-tablist">
          <Tabs.Tab value="inputs">{inputsLabel}</Tabs.Tab>
          <Tabs.Tab value="results">Results</Tabs.Tab>
          {range && <Tabs.Tab value="range">Range</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="inputs" className="workspace-inputs">
          {inputs}
        </Tabs.Panel>
        <Tabs.Panel value="results" className="workspace-results">
          {/* scrolls on its own from 62em, so it takes focus for keyboard scrolling */}
          <section
            id="results"
            aria-label="Results"
            // the skip link focuses it; a tab stop only while it scrolls
            tabIndex={-1}
            {...scrollFocus}
            className="workspace-scroll"
          >
            {results}
          </section>
        </Tabs.Panel>
        {range && (
          <Tabs.Panel value="range" className="workspace-range">
            {tab === 'range' && range}
          </Tabs.Panel>
        )}
      </Tabs>
      {tab !== 'range' && <div className="workspace-bar">{bar(show)}</div>}
    </div>
  )
}

/**
 * Copy link: the inputs of `query` in the address bar's fragment and on the clipboard; `copied`
 * for 2 s. In the fragment they never reach the server or its logs.
 */
export function useCopyLink(query: () => string) {
  const clipboard = useClipboard({ timeout: 2000 })
  return {
    copied: clipboard.copied,
    copy: () => {
      // the address bar keeps the link where the clipboard is not allowed (plain http)
      window.history.replaceState(null, '', `${window.location.pathname}#${query()}`)
      clipboard.copy(window.location.href)
    },
  }
}

/**
 * The workbench's page actions in the bar's order: `file` (Open and Save), `search`, Copy link,
 * then `after` (Print). From 75em Search, Copy link and Print show as icons, named by their text.
 */
export function Toolbar({
  search,
  file,
  after,
  link,
}: {
  /** The workbench's record search button. */
  search?: ReactNode | undefined
  /** Open and Save (`FileMenu`). */
  file?: ReactNode | undefined
  /** Print. */
  after?: ReactNode | undefined
  /** The page's `useCopyLink`, shared with the other controls that copy the link. */
  link: ReturnType<typeof useCopyLink>
}) {
  const { copied, copy } = link
  return (
    <>
      {file}
      {search}
      <Button
        variant="default"
        className="bar-icon"
        title={copied ? 'Link copied' : 'Copy link'}
        leftSection={
          copied ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <LinkSimple size={18} aria-hidden="true" />
          )
        }
        onClick={copy}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
      {after}
    </>
  )
}
