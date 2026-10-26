'use client'

import { useMantineColorScheme } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useContext } from 'react'
import { sections } from '../lib/sections.ts'
import { shortcutLabel } from '../lib/shortcuts.ts'
import { openSafety } from './safety-dialog.tsx'
import { SettingsDialog } from './settings-dialog.ts'
import { openShortcuts } from './shortcuts.tsx'

/** A command of the search; `keys` names its shortcut, shown beside it. */
export type Command = { label: string; run: () => void; keys?: string | undefined }

/**
 * The search's groups of every page: the sidebar's pages, and the shell's commands
 * (settings, Safety, theme). Navigation goes through the router's guarded `push`, so a
 * page with unsaved work asks first (`navigation-guard.ts`).
 */
export function useShellActions(): { pages: Command[]; commands: Command[] } {
  const router = useRouter()
  const openSettings = useContext(SettingsDialog)
  const { setColorScheme } = useMantineColorScheme()
  return {
    pages: [
      { label: 'Home', run: () => router.push('/') },
      ...sections.flatMap((s) =>
        s.pages.map((p) => ({ label: p.label, run: () => router.push(p.href) })),
      ),
    ],
    commands: [
      { label: 'Settings', run: () => openSettings() },
      { label: 'Units settings', run: () => openSettings('units') },
      { label: 'Workbench defaults', run: () => openSettings('defaults') },
      { label: 'Safety notice', run: openSafety },
      { label: 'Keyboard shortcuts', run: openShortcuts, keys: shortcutLabel('help') },
      { label: 'Theme: system', run: () => setColorScheme('auto') },
      { label: 'Theme: light', run: () => setColorScheme('light') },
      { label: 'Theme: dark', run: () => setColorScheme('dark') },
    ],
  }
}
