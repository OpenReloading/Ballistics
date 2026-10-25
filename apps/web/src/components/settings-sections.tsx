'use client'

import {
  Box,
  Button,
  type MantineColorScheme,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { pagesBasePath } from '../lib/edition.ts'
import { openFirstRun } from './first-run-dialog.tsx'
import { useInstall } from './install-button.tsx'
import { ManufacturersForm } from './manufacturers-settings.tsx'
import type { SettingsTab } from './settings-dialog.ts'
import { UnitsForm } from './units-settings.tsx'
import { WorkbenchDefaultsForm } from './workbench-defaults.tsx'

function Appearance() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  return (
    <div>
      <p className="segment-label" id="settings-theme">
        Theme
      </p>
      <SegmentedControl
        aria-labelledby="settings-theme"
        value={colorScheme}
        data={[
          { value: 'auto', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={(v) => setColorScheme(v as MantineColorScheme)}
      />
    </div>
  )
}

function Offline() {
  const install = useInstall()
  return (
    <Stack gap="sm" align="flex-start">
      <Text size="sm">
        {pagesBasePath === undefined
          ? 'Pages you have opened, the tools and your own records work without network; a workbench run needs it.'
          : 'Pages you have opened, the tools, workbench runs and your own records work without network.'}
      </Text>
      {install ? (
        <Button onClick={install}>Install as an app</Button>
      ) : (
        <Box component="ul" m={0} pis="1.25rem" fz="sm">
          <li>Chrome, Edge: Install in the address bar or the browser menu.</li>
          <li>Safari on iPhone and iPad: Share, then Add to Home Screen.</li>
          <li>Safari on a Mac: File, then Add to Dock.</li>
        </Box>
      )}
    </Stack>
  )
}

/**
 * The settings dialog's body: vertical tabs Units, Workbench defaults, Manufacturers, Appearance
 * and Offline, a row of tabs on a phone. Loaded apart from the pages when the dialog first opens.
 */
export function SettingsSections({
  tab,
  onTab,
}: {
  tab: SettingsTab
  onTab: (t: SettingsTab) => void
}) {
  const phone = useMediaQuery('(max-width: 35.99em)')
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
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="units">Units</Tabs.Tab>
        <Tabs.Tab value="defaults">Workbench defaults</Tabs.Tab>
        <Tabs.Tab value="manufacturers">Manufacturers</Tabs.Tab>
        <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
        <Tabs.Tab value="offline">Offline</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="units">
        <Text size="sm" c="dimmed" mb="xs">
          Values are kept in SI units: a change converts what is shown, never a value.
        </Text>
        <UnitsForm />
        <Button variant="default" mt="sm" onClick={openFirstRun}>
          Show the first-run step
        </Button>
      </Tabs.Panel>
      <Tabs.Panel value="defaults">
        <Text size="sm" c="dimmed" mb="xs">
          New workbench loads start from these values; an open load keeps its own.
        </Text>
        <WorkbenchDefaultsForm />
      </Tabs.Panel>
      <Tabs.Panel value="manufacturers">
        <ManufacturersForm />
      </Tabs.Panel>
      <Tabs.Panel value="appearance">
        <Appearance />
      </Tabs.Panel>
      <Tabs.Panel value="offline">
        <Offline />
      </Tabs.Panel>
    </Tabs>
  )
}
