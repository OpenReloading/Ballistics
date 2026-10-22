'use client'

import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { useMounted } from '@mantine/hooks'
import { Moon, Sun } from '@phosphor-icons/react'

/** Two-state light/dark switch; Mantine's light/dark-hidden classes pick the icon, so it is right before hydration. */
export function ThemeSwitch() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light')
  // hydration keeps the server's attributes, so the stored scheme applies only after mounting
  const dark = useMounted() && computed === 'dark'
  return (
    <ActionIcon
      variant="default"
      aria-label="Dark theme"
      aria-pressed={dark}
      title="Dark theme"
      onClick={() => setColorScheme(dark ? 'light' : 'dark')}
    >
      <Sun size={20} className="mantine-dark-hidden" aria-hidden="true" />
      <Moon size={20} className="mantine-light-hidden" aria-hidden="true" />
    </ActionIcon>
  )
}
