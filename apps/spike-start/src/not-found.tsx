import { useLingui } from '@lingui/react'
import { PageBar } from '@open-reloading/ui'

export function NotFound() {
  const { i18n } = useLingui()
  return <PageBar title={i18n._({ id: 'record.missing', message: 'There is no such record.' })} />
}
