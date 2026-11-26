import { useLingui } from '@lingui/react'
import { PageBar } from '@rangefoundry/ui'
import { useMatch } from '@tanstack/react-router'
import { loadEnglish } from '../i18n/lingui.ts'
import titlesEnglish from '../locales/en/routes/-static-paths.json' with { type: 'json' }
import { pageTitles, type StaticRoute } from './-static-paths.ts'

// the Vite config reads -static-paths.ts, so its English loads here, where its titles show
loadEnglish(titlesEnglish)

export function PlaceholderPage() {
  const { i18n } = useLingui()
  const { fullPath } = useMatch({ strict: false })
  // only static routes render it, and an index route's path ends in a slash
  return <PageBar title={i18n._(pageTitles[fullPath.replace(/\/$/, '') as StaticRoute])} />
}
