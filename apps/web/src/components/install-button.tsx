import { useLingui } from '@lingui/react'
import { ActionIcon, Tooltip } from '@mantine/core'
import { useSyncExternalStore } from 'react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/install-button.json' with { type: 'json' }
import { NavIcon } from './nav-icons.tsx'

loadEnglish(englishMessages)

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
  const { i18n } = useLingui()
  if (!install) return null
  return (
    <Tooltip
      label={i18n._({ id: 'install.tooltip', message: 'Install as an app' })}
      position={position}
    >
      <ActionIcon
        variant="default"
        aria-label={i18n._({ id: 'install.label', message: 'Install' })}
        onClick={install}
      >
        <NavIcon name="install" />
      </ActionIcon>
    </Tooltip>
  )
}
