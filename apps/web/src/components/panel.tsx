'use client'

import { Paper } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Message } from '../i18n/translate.ts'

/**
 * A titled panel of the page template: one border and radius, a title row of at most 28 px
 * with the panel's own controls at its right, the content below. Flat on phones (no border or
 * padding), flat in print (no border, radius or background) and never split across pages.
 */
export function Panel({
  id,
  title: given,
  translated,
  controls,
  className,
  children,
}: {
  /** The title's id; a table in the panel names itself by it (`aria-labelledby`). */
  id: string
  /** The heading: text as shown, or with `translated` a message of the catalogue. */
  title: string | Message
  /** `title` is a message that the language shown translates. */
  translated?: boolean
  /** Beside the title: a view switch, a filter, a search field. */
  controls?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  // the type of `title` says a translated one is a Message
  const title = translated ? t(given as Message) : given
  return (
    <Paper
      component="section"
      withBorder
      className={className ? `page-panel ${className}` : 'page-panel'}
      aria-labelledby={id}
    >
      <div className="page-panel-head">
        <h2 id={id} className="page-panel-title record-heading">
          {title}
        </h2>
        {controls}
      </div>
      {children}
    </Paper>
  )
}
