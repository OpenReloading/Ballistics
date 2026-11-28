import { useLingui } from '@lingui/react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/results-skip-link.json' with { type: 'json' }
import { useRoute } from './use-route.ts'

loadEnglish(englishMessages)

/** The first skip link of every page, to the page's main content. */
export function ContentSkipLink() {
  const { i18n } = useLingui()
  return (
    <a className="skip-link" href="#main">
      {i18n._({ id: 'skipLink.content', message: 'Skip to content' })}
    </a>
  )
}

/** Second skip link on the workbench; `Workspace` shows the results (on phones their tab) and focuses them, also when the page opens at #results. */
export function ResultsSkipLink() {
  const path = useRoute()
  const { i18n } = useLingui()
  if (path !== '/workbench') return null
  return (
    <a
      className="skip-link"
      href="#results"
      onClick={(e) => {
        // unhandled until `Workspace` hydrates (after the layout): then the link goes to #results and `Workspace` shows the results on mount
        if (!window.dispatchEvent(new Event('show-results', { cancelable: true })))
          e.preventDefault()
      }}
    >
      {i18n._({ id: 'skipLink.results', message: 'Skip to results' })}
    </a>
  )
}
