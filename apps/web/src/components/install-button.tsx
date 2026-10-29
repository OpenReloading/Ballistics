'use client'

import { ActionIcon, Tooltip } from '@mantine/core'
import { useSyncExternalStore } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { NavIcon } from './nav-icons.tsx'

/** Chromium's install offer (https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent). */
type InstallOffer = Event & { prompt(): Promise<void> }

let offer: InstallOffer | undefined
const listeners = new Set<() => void>()
const setOffer = (e: InstallOffer | undefined) => {
  offer = e
  for (const l of listeners) l()
}
// at module load, so an offer made before the header renders is kept
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setOffer(e as InstallOffer)
  })
  window.addEventListener('appinstalled', () => setOffer(undefined))
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The browser's install prompt while it offers one (the offer is used once), else undefined. */
export function useInstall() {
  const current = useSyncExternalStore(
    subscribe,
    () => offer,
    () => undefined,
  )
  return (
    current &&
    (() => {
      setOffer(undefined)
      current.prompt().catch(() => {})
    })
  )
}

/** Install: shown only while the browser offers to install the app; one offer, one prompt. */
export function InstallButton({ position }: { position: 'right' | 'bottom' }) {
  const install = useInstall()
  const { t } = useTranslation()
  if (!install) return null
  return (
    <Tooltip label={t('Install as an app')} position={position}>
      <ActionIcon variant="default" aria-label={t('Install')} onClick={install}>
        <NavIcon name="install" />
      </ActionIcon>
    </Tooltip>
  )
}
