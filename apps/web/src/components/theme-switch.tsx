'use client'

import { useLingui } from '@lingui/react'
import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useMounted } from '@mantine/hooks'
import { Moon, Sun } from 'lucide-react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/theme-switch.json' with { type: 'json' }

loadEnglish(englishMessages)

const label = /*i18n*/ { id: 'themeSwitch.dark', message: 'Dark theme' }

/** Two-state light/dark switch; Mantine's light/dark-hidden classes pick the icon, so it is right before hydration. */
export function ThemeSwitch() {
  const { setColorScheme } = useMantineColorScheme()
  const { i18n } = useLingui()
  const computed = useComputedColorScheme('light')
  // hydration keeps the server's attributes, so the stored scheme applies only after mounting
  const dark = useMounted() && computed === 'dark'
  return (
    <ActionIcon
      variant="default"
      aria-label={i18n._(label)}
      aria-pressed={dark}
      title={i18n._(label)}
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      <Sun size={20} className="mantine-dark-hidden" aria-hidden="true" />
      <Moon size={20} className="mantine-light-hidden" aria-hidden="true" />
    </ActionIcon>
  )
}
