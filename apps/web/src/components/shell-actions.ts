'use client'

import { useMantineColorScheme } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { sections } from '../lib/sections.ts'
import { shortcutLabel } from '../lib/shortcuts.ts'
import { openSafety } from './safety-dialog.tsx'
import { SettingsDialog } from './settings-dialog.ts'
import { openShortcuts, useSingleKeys } from './shortcuts.tsx'

/** A command of the search; `keys` names its shortcut, shown beside it. */
export type Command = { label: string; run: () => void; keys?: string }

/**
 * The search's groups of every page: the sidebar's pages, and the shell's commands
 * (settings, Safety, theme). Navigation goes through the router's guarded `push`, so a
 * page with unsaved work asks first (`navigation-guard.ts`).
 */
export function useShellActions(): { pages: Command[]; commands: Command[] } {
  const router = useRouter()
  const openSettings = useContext(SettingsDialog)
  const { setColorScheme } = useMantineColorScheme()
  const singleKeys = useSingleKeys()
  const { t } = useTranslation()
  return {
    pages: [
      { label: t('Home'), run: () => router.push('/') },
      // the pages, and each tab of the Library pages by its own name (Powders, Firearms…)
      ...sections.flatMap((s) =>
        s.pages.flatMap((p) =>
          [p, ...('tabs' in p ? p.tabs : [])].map((x) => ({
            label: t(x.label),
            run: () => router.push(x.href),
          })),
        ),
      ),
    ],
    commands: [
      { label: t('Settings'), run: () => openSettings() },
      { label: t('Units settings'), run: () => openSettings('units') },
      { label: t('Workbench settings'), run: () => openSettings('workbench') },
      { label: t('Safety notice'), run: openSafety },
      {
        label: t('Keyboard shortcuts'),
        run: openShortcuts,
        ...(singleKeys && { keys: shortcutLabel('help') }),
      },
      { label: t('Theme: system'), run: () => setColorScheme('auto') },
      { label: t('Theme: light'), run: () => setColorScheme('light') },
      { label: t('Theme: dark'), run: () => setColorScheme('dark') },
    ],
  }
}
