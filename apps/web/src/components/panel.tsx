import { useLingui } from '@lingui/react'
import { Paper } from '@mantine/core'
import type { ReactNode } from 'react'
import { type LinguiWording, sayLingui } from '../lib/wording.ts'

/** A title row of at most 28 px; flat on phones (no border or padding) and in print (no border, radius or background), never split across pages. */
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
  /** Beside the title: a view switch, a filter, a search field. */
  controls?: ReactNode
  className?: string
  children: ReactNode
} & (
  | {
      /** The heading as shown. */
      title: string
      translated?: false
    }
  | {
      /** The heading: a message, which the language shown translates. */
      title: LinguiWording
      translated: true
    }
)) {
  const { i18n } = useLingui()
  const title = translated ? sayLingui(i18n, given) : given
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
