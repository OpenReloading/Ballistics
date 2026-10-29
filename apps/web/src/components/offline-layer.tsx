'use client'

import { Affix, Button, CloseButton, Paper, Text, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { basePath } from '../lib/edition.ts'
import { controlSize } from '../lib/theme.ts'

/**
 * Registers the service worker of production builds, removes one in
 * development, and shows "New version" while a worker of a newer build waits. Reload lets it take
 * over and reloads this tab; nothing here touches the browser store of the user's records.
 */
export function OfflineLayer() {
  const [waiting, setWaiting] = useState<ServiceWorker>()
  const wide = useMediaQuery('(min-width: 75em)')
  const { t } = useTranslation()
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    // a worker left by a production build on this origin would answer `next dev` from its caches
    if (process.env.NODE_ENV !== 'production') {
      sw.getRegistrations().then(
        (rs) => {
          for (const r of rs) void r.unregister()
        },
        () => {},
      )
      return
    }
    sw.register(`${basePath}/sw.js`, { scope: `${basePath}/`, updateViaCache: 'none' }).then(
      (r: ServiceWorkerRegistration | undefined) => {
        // Playwright's blocked workers resolve without one
        if (!r) return
        // a worker waiting while another one controls the page is a new version
        const check = () => {
          if (r.waiting && sw.controller) setWaiting(r.waiting)
        }
        check()
        r.addEventListener('updatefound', () =>
          r.installing?.addEventListener('statechange', check),
        )
      },
      () => {},
    )
  }, [])
  if (!waiting) return null
  // never over a page action: from 75em at the bottom right, below the page bar's actions
  // and clear of the workbench's Run bar at the left; narrower under the top bar, where the open
  // Page actions panel (z-index 101) lies over it
  return (
    <Affix
      position={wide ? { bottom: 16, right: 16 } : { top: 60, right: 16 }}
      zIndex={wide ? 150 : 99}
    >
      <Paper withBorder shadow="md" className="update-notice" role="status">
        <Text size="sm" fw={600}>
          {t('New version')}
        </Text>
        <Tooltip label={t('Loads the new version; your records in this browser stay')}>
          <Button
            size={controlSize.row.button}
            onClick={() => {
              // already active (Reload in another tab, or a leave prompt answered Stay): reload only
              if (waiting.state !== 'installed') return location.reload()
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                {
                  once: true,
                },
              )
              waiting.postMessage('skip-waiting')
            }}
          >
            {t('Reload')}
          </Button>
        </Tooltip>
        <CloseButton aria-label={t('Later')} onClick={() => setWaiting(undefined)} />
      </Paper>
    </Affix>
  )
}
