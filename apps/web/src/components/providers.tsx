import { useLingui } from '@lingui/react'
import { Button, Group } from '@mantine/core'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import dynamic from '@/platform/dynamic.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { useRoute } from './use-route.ts'
import '../lib/navigation-guard.ts'
import englishMessages from '../locales/en/components/providers.json' with { type: 'json' }
import { AppModal } from './app-modal.tsx'
import { SettingsDialog, type SettingsTab } from './settings-dialog.ts'
import { Loading } from './states.tsx'

// the forms load when the dialog first opens, so pages ship without them
const SettingsSections = dynamic(
  () => import('./settings-sections.tsx').then((m) => m.SettingsSections),
  { loading: () => <Loading what="the settings" /> },
)

loadEnglish(englishMessages)

/** The settings dialog over any page: every Settings and Units button opens it through `SettingsDialog`. */
export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const { i18n } = useLingui()
  const [opened, setOpened] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('units')
  const close = () => setOpened(false)
  // the context value: one function, so its consumers do not render again on a route change
  const open = useCallback((t: SettingsTab = 'units') => {
    setTab(t)
    setOpened(true)
  }, [])
  const route = useRoute()
  // a link inside the dialog leaves the page
  useEffect(() => close(), [route])
  return (
    <SettingsDialog value={open}>
      {children}
      <AppModal
        opened={opened}
        onClose={close}
        size="xl"
        title={i18n._({ id: 'shell.settings', message: 'Settings' })}
        className="settings-dialog"
        closeButton={{
          'aria-label': i18n._({ id: 'settingsDialog.close', message: 'Close settings' }),
        }}
        footer={
          <Group justify="flex-end" className="settings-foot">
            <Button variant="default" onClick={close}>
              {i18n._({ id: 'settingsDialog.done', message: 'Close' })}
            </Button>
          </Group>
        }
      >
        <SettingsSections tab={tab} onTab={setTab} onClose={close} />
      </AppModal>
    </SettingsDialog>
  )
}
