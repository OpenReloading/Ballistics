import { useLingui } from '@lingui/react'
import { PageBar } from '@rangefoundry/ui'
import { PageNotFound } from '../components/page-not-found.tsx'

export const NotFoundPage = PageNotFound

export function LoadFailedPage() {
  const { i18n } = useLingui()
  return <PageBar title={i18n._({ id: 'error.title', message: 'This page could not be shown.' })} />
}
