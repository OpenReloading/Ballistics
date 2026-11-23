import { useLingui } from '@lingui/react'
import { PageBar } from '@rangefoundry/ui'
import { useMatch } from '@tanstack/react-router'
import { pageTitles, type StaticRoute } from './-static-paths.ts'

export function PlaceholderPage() {
  const { i18n } = useLingui()
  const { fullPath } = useMatch({ strict: false })
  // only static routes render it, and an index route's path ends in a slash
  return <PageBar title={i18n._(pageTitles[fullPath.replace(/\/$/, '') as StaticRoute])} />
}
