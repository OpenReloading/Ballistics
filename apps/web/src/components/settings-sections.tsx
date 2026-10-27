'use client'

import {
  Box,
  Button,
  Checkbox,
  type MantineColorScheme,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'
import { chooseLanguage, type Language, languages, useTranslation } from '../i18n/language.ts'
import { useInstall } from './install-button.tsx'
import { ManufacturersForm } from './manufacturers-settings.tsx'
import type { SettingsTab } from './settings-dialog.ts'
import { setSingleKeys, useSingleKeys } from './shortcuts.tsx'
import { UnitsForm } from './units-settings.tsx'
import { WorkbenchDefaultsForm } from './workbench-defaults.tsx'
import { YourDataForm } from './your-data-settings.tsx'

function Appearance() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const { t } = useTranslation()
  return (
    <div>
      <p className="segment-label" id="settings-theme">
        {t('Theme')}
      </p>
      <SegmentedControl
        aria-labelledby="settings-theme"
        value={colorScheme}
        data={[
          { value: 'auto', label: t('System') },
          { value: 'light', label: t('Light') },
          { value: 'dark', label: t('Dark') },
        ]}
        onChange={(v) => setColorScheme(v as MantineColorScheme)}
      />
    </div>
  )
}

/** The language of the interface, labelled by its section's title. The names are each language's own, so one can be found from any. */
function LanguageChoice() {
  const { chosen } = useTranslation()
  return (
    <SegmentedControl
      aria-labelledby="settings-language"
      value={chosen}
      data={languages.map((l) => ({
        value: l.code,
        label: <span lang={l.code}>{l.name}</span>,
      }))}
      onChange={(v) => chooseLanguage(v as Language)}
    />
  )
}

function Keyboard() {
  const on = useSingleKeys()
  const { t } = useTranslation()
  return (
    <Checkbox
      checked={on}
      onChange={(e) => setSingleKeys(e.currentTarget.checked)}
      label={t('Single-key shortcuts')}
      description={t(
        '? opens the shortcut list and / searches the list on a page. Off, they do nothing; the shortcuts with Ctrl or Cmd stay.',
      )}
    />
  )
}

function Offline() {
  const install = useInstall()
  const { t } = useTranslation()
  return (
    <Stack gap="sm" align="flex-start">
      <Text size="sm">
        {t(
          'Pages you have opened, the tools, workbench runs and your own records work without network.',
        )}
      </Text>
      {install ? (
        <Button onClick={install}>{t('Install as an app')}</Button>
      ) : (
        <Box component="ul" m={0} pis="1.25rem" fz="sm">
          <li>{t('Chrome, Edge: Install in the address bar or the browser menu.')}</li>
          <li>{t('Safari on iPhone and iPad: Share, then Add to Home Screen.')}</li>
          <li>{t('Safari on a Mac: File, then Add to Dock.')}</li>
        </Box>
      )}
    </Stack>
  )
}

/** A headed block of the General tab. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Stack component="section" gap="xs" aria-labelledby={id}>
      <Title order={3} id={id}>
        {title}
      </Title>
      {children}
    </Stack>
  )
}

/**
 * The settings dialog's body: vertical tabs General, Units and Workbench, a row of tabs on a
 * phone. Loaded apart from the pages when the dialog first opens.
 */
export function SettingsSections({
  tab,
  onTab,
  onClose,
}: {
  tab: SettingsTab
  onTab: (t: SettingsTab) => void
  onClose: () => void
}) {
  const phone = useMediaQuery('(max-width: 35.99em)')
  const { t } = useTranslation()
  return (
    <Tabs
      value={tab}
      onChange={(t) => t && onTab(t as SettingsTab)}
      orientation={phone ? 'horizontal' : 'vertical'}
      // the panel clear of the tab list; vertical tab labels start at the left
      styles={
        phone
          ? { panel: { paddingTop: '0.75rem' } }
          : { panel: { paddingInlineStart: '1rem' }, tabLabel: { textAlign: 'left' } }
      }
    >
      <Tabs.List aria-label={t('Settings')}>
        <Tabs.Tab value="general">{t('General')}</Tabs.Tab>
        <Tabs.Tab value="units">{t('Units')}</Tabs.Tab>
        <Tabs.Tab value="workbench">{t('Workbench')}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="general">
        <Stack gap="lg">
          <Section id="settings-appearance" title={t('Appearance')}>
            <Appearance />
          </Section>
          <Section id="settings-language" title={t('Language')}>
            <LanguageChoice />
          </Section>
          <Section id="settings-keyboard" title={t('Keyboard')}>
            <Keyboard />
          </Section>
          <Section id="settings-your-data" title={t('Your data')}>
            <YourDataForm onNavigate={onClose} />
          </Section>
          <Section id="settings-offline" title={t('Offline')}>
            <Offline />
          </Section>
          {/* temporary home: moves with the page for the browser's own records */}
          <Section id="settings-manufacturers" title={t('Manufacturers in this browser')}>
            <ManufacturersForm />
          </Section>
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="units">
        <Text size="sm" c="dimmed" mb="xs">
          {t('Values are kept in SI units: a change converts what is shown, never a value.')}
        </Text>
        <UnitsForm />
      </Tabs.Panel>
      <Tabs.Panel value="workbench">
        <Text size="sm" c="dimmed" mb="xs">
          {t('New workbench loads start from these values; an open load keeps its own.')}
        </Text>
        <WorkbenchDefaultsForm />
      </Tabs.Panel>
    </Tabs>
  )
}
