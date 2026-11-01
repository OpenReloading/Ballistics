'use client'

import type { Provenance } from '@open-reloading/schema'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { say, type Wording } from '../lib/wording.ts'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { RecordActions } from './record-actions.tsx'
import { provenanceKinds, Sources } from './sources.tsx'
import { MutedBadge } from './standard-badge.tsx'

/**
 * The frame of a record page (the cartridge and powder records build on it): the page bar with
 * the name, the badges after it and the actions (Use in workbench, Open in designer, Compare, Units, Copy
 * link, Print), then from 62em a fixed grid of figure, values, and the side column with the
 * sources below it. On a phone one column in document order: figure, values, side,
 * sources.
 */
export function RecordPage({
  title,
  short,
  badges,
  className,
  compare,
  badgeNodes,
  workbench,
  groups,
  design,
  tune,
  strip,
  figure,
  values,
  side,
  provenance,
  kind,
  sourceFacts,
}: {
  title: string
  /** The title on a phone, where the bar has room for the name alone (`PageBar`). */
  short?: string | undefined
  /** Facts beside the title (line, caliber, product number), not repeated in the tables. */
  badges: Wording[]
  /** A layout of the grid, such as `record-chart` (powder) or `cartridge-record`. */
  className?: string
  /** "Compare" link. */
  compare?: string | undefined
  /** The badges as drawn in the bar, where they are more than text (the cartridge record's notes on hover); `badges` stays the line below 75em. */
  badgeNodes?: ReactNode
  /** A line under the bar, over the grid (the cartridge record's pressures). */
  strip?: ReactNode
  /** "Use in workbench" link. */
  workbench?: string | undefined
  /** "Open in shot groups" link. */
  groups?: string | undefined
  /** "Open in designer" link. */
  design?: string | undefined
  /** "Tune from strings" link (a powder). */
  tune?: string | undefined
  /** The figure section; a record whose values carry their own figures (the cartridge's) has none. */
  figure?: ReactNode
  /** The values section: the record's table. */
  values: ReactNode
  /** The side column: coefficients, notes. */
  side?: ReactNode | undefined
  provenance: Provenance
  /** The record kind (`powders`), whose field labels name the fields a source covers. */
  kind?: string | undefined
  /** Over the sources table: facts of the record's standard (the cartridge record's table, date, country and method). */
  sourceFacts?: ReactNode
}) {
  const { t } = useTranslation()
  const facts = badges.map((b) => say(t, b))
  return (
    <div className={`record record-frame${className ? ` ${className}` : ''}`}>
      <PageBar
        title={title}
        short={short}
        after={
          badgeNodes ??
          facts.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <MutedBadge key={i} className="record-badge">
              {b}
            </MutedBadge>
          ))
        }
        actions={
          <RecordActions
            compare={compare}
            workbench={workbench}
            groups={groups}
            design={design}
            tune={tune}
            tour
          />
        }
      />
      {/* below 75em the bar has no room beside the title: the same facts as a line under it */}
      {facts.length > 0 && (
        <p className="record-facts">
          {facts.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <span key={i}>{i < facts.length - 1 ? `${b} · ` : b}</span>
          ))}
        </p>
      )}
      {strip}
      <div className="record-grid">
        {figure && <div className="record-figure">{figure}</div>}
        <div className="record-values">{values}</div>
        {side && <div className="record-side">{side}</div>}
        <Panel
          id="record-sources"
          title={t('Sources ({kind})', { kind: t(provenanceKinds[provenance.kind]) })}
          className="record-sources"
        >
          {sourceFacts}
          <Sources provenance={provenance} kind={kind} />
        </Panel>
      </div>
    </div>
  )
}
