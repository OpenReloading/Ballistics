'use client'

import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import type { Source } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/source-link.json' with { type: 'json' }

loadEnglish(englishMessages)

const entryTitles = {
  range: /*i18n*/ { id: 'sourceLink.entry.range', message: 'Entered at the range' },
  targetDesigner: /*i18n*/ {
    id: 'sourceLink.entry.targetDesigner',
    message: 'Entered in the target designer',
  },
}

/** The title of `source`; one the user entered in the app is named in the language shown. */
export const sourceTitle = (source: Source, i18n: I18n) =>
  source.title ?? (source.entry ? i18n._(entryTitles[source.entry]) : '')

/** A source title, linked when it has a URL, and its page. */
export function SourceLink({ source }: { source: Source }) {
  const { i18n } = useLingui()
  const title = sourceTitle(source, i18n)
  return (
    <>
      {source.url ? <a href={source.url}>{title}</a> : title}
      {source.page &&
        i18n._({ id: 'sourceLink.page', message: ', page {page}', values: { page: source.page } })}
    </>
  )
}
