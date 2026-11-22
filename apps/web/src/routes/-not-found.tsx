import { useLingui } from '@lingui/react'
import { PageBar } from '@rangefoundry/ui'

export function NotFoundPage() {
  const { i18n } = useLingui()
  return <PageBar title={i18n._({ id: 'notFound.title', message: 'Page not found' })} />
}

export function LoadFailedPage() {
  const { i18n } = useLingui()
  return <PageBar title={i18n._({ id: 'error.title', message: 'This page could not be shown.' })} />
}
