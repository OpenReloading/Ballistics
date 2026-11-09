'use client'

import type { Source } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'
import { msg, type Translator } from '../i18n/translate.ts'

const entryTitles = {
  range: msg('Entered at the range'),
  targetDesigner: msg('Entered in the target designer'),
}

/** The title of `source`; one the user entered in the app is named in the language shown. */
export const sourceTitle = (source: Source, t: Translator['t']) =>
  source.title ?? (source.entry ? t(entryTitles[source.entry]) : '')

/** A source title, linked when it has a URL, and its page. */
export function SourceLink({ source }: { source: Source }) {
  const { t } = useTranslation()
  const title = sourceTitle(source, t)
  return (
    <>
      {source.url ? <a href={source.url}>{title}</a> : title}
      {source.page && t(', page {page}', { page: source.page })}
    </>
  )
}
