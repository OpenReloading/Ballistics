'use client'

import { Menu } from '@mantine/core'
import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from '../i18n/language.ts'
import {
  allSections,
  omittedSections,
  type PrintChoice,
  type PrintSection,
  parsePrintChoice,
  printSections,
  printSectionsKey,
} from '../lib/print-sections.ts'

const listeners = new Set<() => void>()
let cached: { text: string | null; choice: PrintChoice } | undefined

/** The stored text; none where the browser keeps no storage (a private window, blocked site data). */
function storedText() {
  try {
    return localStorage.getItem(printSectionsKey)
  } catch {
    return null
  }
}

/** The choice of this browser, the same object while its text is unchanged. */
function current(): PrintChoice {
  const text = storedText()
  if (cached?.text !== text) cached = { text, choice: parsePrintChoice(text) }
  return cached.choice
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  // a change made in another tab
  const onStorage = (e: StorageEvent) => {
    if (e.key === printSectionsKey) notify()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(notify)
    window.removeEventListener('storage', onStorage)
  }
}

function setSection(key: PrintSection, on: boolean) {
  const next = { ...current(), [key]: on }
  try {
    localStorage.setItem(printSectionsKey, JSON.stringify(next))
  } catch {
    // kept for this page only
    cached = { text: storedText(), choice: next }
  }
  for (const notify of listeners) notify()
}

/**
 * The sections of the workbench report that print, remembered in this browser. While mounted,
 * `<html data-report-omit>` names the ones left out for the print rules (the chart copy).
 */
export function usePrintChoice(): PrintChoice {
  const choice = useSyncExternalStore(subscribe, current, () => allSections)
  const omit = omittedSections(choice)
  useEffect(() => {
    const html = document.documentElement
    if (omit) html.dataset.reportOmit = omit
    else delete html.dataset.reportOmit
    return () => {
      delete html.dataset.reportOmit
    }
  }, [omit])
  return choice
}

/** The Print menu's tick-boxes of the report's sections; the menu stays open while they change. */
export function PrintSectionItems() {
  const { t } = useTranslation()
  const choice = useSyncExternalStore(subscribe, current, () => allSections)
  return (
    <>
      <Menu.Divider />
      <Menu.Label>{t('Report sections')}</Menu.Label>
      {printSections.map((s) => (
        <Menu.CheckboxItem
          key={s.key}
          checked={choice[s.key]}
          onChange={(on) => setSection(s.key, on)}
        >
          {t(s.label)}
        </Menu.CheckboxItem>
      ))}
    </>
  )
}
