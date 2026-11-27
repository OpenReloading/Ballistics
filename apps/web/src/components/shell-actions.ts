'use client'

import { useLingui } from '@lingui/react'
import { useMantineColorScheme } from '@mantine/core'
import { useContext } from 'react'
import { useRouter } from '@/platform/navigation.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { sections } from '../lib/sections.ts'
import { shortcutLabel } from '../lib/shortcuts.ts'
import englishMessages from '../locales/en/components/shell-actions.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { openSafety } from './safety-dialog.tsx'
import { SettingsDialog } from './settings-dialog.ts'
import { openShortcuts, useSingleKeys } from './shortcuts.tsx'

loadEnglish(englishMessages, sectionsEnglish)

/** A command of the search; `keys` names its shortcut, shown beside it. */
export type Command = { label: string; run: () => void; keys?: string }

/** Navigation goes through the router's guarded `push`, so a page with unsaved work asks first (`navigation-guard.ts`). */
export function useShellActions(): { pages: Command[]; commands: Command[] } {
  const router = useRouter()
  const openSettings = useContext(SettingsDialog)
  const { setColorScheme } = useMantineColorScheme()
  const singleKeys = useSingleKeys()
  const { i18n } = useLingui()
  return {
    pages: [
      { label: i18n._({ id: 'shellActions.home', message: 'Home' }), run: () => router.push('/') },
      // the pages, and each tab of the Library pages by its own name (Powders, Firearms…)
      ...sections.flatMap((s) =>
        s.pages.flatMap((p) =>
          [p, ...('tabs' in p ? p.tabs : [])].map((x) => ({
            label: i18n._(x.label),
            run: () => router.push(x.href),
          })),
        ),
      ),
    ],
    commands: [
      { label: i18n._({ id: 'shell.settings', message: 'Settings' }), run: () => openSettings() },
      {
        label: i18n._({ id: 'shellActions.unitsSettings', message: 'Units settings' }),
        run: () => openSettings('units'),
      },
      {
        label: i18n._({ id: 'shellActions.workbenchSettings', message: 'Workbench settings' }),
        run: () => openSettings('workbench'),
      },
      {
        label: i18n._({ id: 'shellActions.safetyNotice', message: 'Safety notice' }),
        run: openSafety,
      },
      {
        label: i18n._({ id: 'shellActions.keyboardShortcuts', message: 'Keyboard shortcuts' }),
        run: openShortcuts,
        ...(singleKeys && { keys: shortcutLabel('help') }),
      },
      {
        label: i18n._({ id: 'shellActions.theme.system', message: 'Theme: system' }),
        run: () => setColorScheme('auto'),
      },
      {
        label: i18n._({ id: 'shellActions.theme.light', message: 'Theme: light' }),
        run: () => setColorScheme('light'),
      },
      {
        label: i18n._({ id: 'shellActions.theme.dark', message: 'Theme: dark' }),
        run: () => setColorScheme('dark'),
      },
    ],
  }
}
