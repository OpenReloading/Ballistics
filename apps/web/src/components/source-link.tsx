'use client'

import type { Source } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'

/** A source title, linked when it has a URL, and its page. */
export function SourceLink({ source }: { source: Source }) {
  const { t } = useTranslation()
  return (
    <>
      {source.url ? <a href={source.url}>{source.title}</a> : source.title}
      {source.page && t(', page {page}', { page: source.page })}
    </>
  )
}
