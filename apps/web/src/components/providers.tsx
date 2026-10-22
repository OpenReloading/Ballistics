'use client'

import { Button, Group, localStorageColorSchemeManager, MantineProvider } from '@mantine/core'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import '../lib/navigation-guard.ts'
import { colorSchemeKey, theme } from '../lib/theme.ts'
import { AppModal } from './app-modal.tsx'
import { ConfirmHost } from './confirm.tsx'
import { SettingsDialog, type SettingsTab } from './settings-dialog.ts'
import { Loading } from './states.tsx'
import { UnitsProvider } from './units-settings.tsx'

// the forms load when the dialog first opens, so pages ship without them
const SettingsSections = dynamic(
  () => import('./settings-sections.tsx').then((m) => m.SettingsSections),
  { ssr: false, loading: () => <Loading what="the settings" /> },
)

const colorSchemeManager = localStorageColorSchemeManager({ key: colorSchemeKey })

/** The settings dialog over any page: every Settings and Units button opens it through `SettingsDialog`. */
function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('units')
  const close = () => setOpened(false)
  // the context value: one function, so its consumers do not render again on a route change
  const open = useCallback((t: SettingsTab = 'units') => {
    setTab(t)
    setOpened(true)
  }, [])
  const route = usePathname()
  // a link inside the dialog leaves the page
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a route change only
  useEffect(() => close(), [route])
  return (
    <SettingsDialog value={open}>
      {children}
      <AppModal
        opened={opened}
        onClose={close}
        size="xl"
        title="Settings"
        className="settings-dialog"
        closeButton={{ 'aria-label': 'Close settings' }}
        footer={
          <Group justify="flex-end" className="settings-foot">
            <Button variant="default" onClick={close}>
              Close
            </Button>
          </Group>
        }
      >
        <SettingsSections tab={tab} onTab={setTab} />
      </AppModal>
    </SettingsDialog>
  )
}

/** Client boundary for the Mantine, units and settings dialog providers: the colour scheme manager holds functions. */
export function Providers({ children }: { children: React.ReactNode }) {
  // the ready signal of the e2e specs: `html[data-hydrated]` once React has attached the handlers
  useEffect(() => {
    document.documentElement.dataset.hydrated = ''
  }, [])
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <UnitsProvider>
        {/* first: its Escape listener is added before the page's dialogs add theirs */}
        <ConfirmHost />
        <SettingsDialogProvider>{children}</SettingsDialogProvider>
      </UnitsProvider>
    </MantineProvider>
  )
}
