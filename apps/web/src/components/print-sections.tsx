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
import { storedChoice } from '../lib/stored-choice.ts'

const printChoice = storedChoice(printSectionsKey, parsePrintChoice, (c) => JSON.stringify(c))

const setSection = (key: PrintSection, on: boolean) =>
  printChoice.set({ ...printChoice.read(), [key]: on })

/** Remembered in this browser; while mounted, `<html data-report-omit>` names those left out for the print rules (the chart copy). */
export function usePrintChoice(): PrintChoice {
  const choice = useSyncExternalStore(printChoice.subscribe, printChoice.read, () => allSections)
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
  const choice = useSyncExternalStore(printChoice.subscribe, printChoice.read, () => allSections)
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
