'use client'

import { useTranslation } from '../i18n/language.ts'
import { useRoute } from './use-route.ts'

/** The first skip link of every page, to the page's main content. */
export function ContentSkipLink() {
  const { t } = useTranslation()
  return (
    <a className="skip-link" href="#main">
      {t('Skip to content')}
    </a>
  )
}

/** Second skip link on the workbench; `Workspace` shows the results (on phones their tab) and focuses them, also when the page opens at #results. */
export function ResultsSkipLink() {
  const path = useRoute()
  const { t } = useTranslation()
  if (path !== '/workbench') return null
  return (
    // biome-ignore lint/a11y/useValidAnchor: a skip link; the handler also opens the Results tab on phones
    <a
      className="skip-link"
      href="#results"
      onClick={(e) => {
        // unhandled until `Workspace` hydrates (after the layout): then the link goes to #results
        // and `Workspace` shows the results on mount
        if (!window.dispatchEvent(new Event('show-results', { cancelable: true })))
          e.preventDefault()
      }}
    >
      {t('Skip to results')}
    </a>
  )
}
