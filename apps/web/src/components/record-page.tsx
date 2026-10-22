import type { ReactNode } from 'react'
import type { Provenance } from '../lib/api-types.ts'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { RecordActions } from './record-actions.tsx'
import { Sources } from './sources.tsx'
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
  badges,
  className,
  compare,
  badgeNodes,
  workbench,
  groups,
  design,
  strip,
  figure,
  values,
  side,
  provenance,
}: {
  title: string
  /** Facts beside the title (line, caliber, product number), not repeated in the tables. */
  badges: string[]
  /** A layout of the grid, such as `record-chart` (powder) or `cartridge-record`. */
  className?: string
  /** "Compare" link. */
  compare?: string
  /** The badges as drawn in the bar, where they are more than text (the cartridge record's notes on hover); `badges` stays the line below 75em. */
  badgeNodes?: ReactNode
  /** A line under the bar, over the grid (the cartridge record's pressures). */
  strip?: ReactNode
  /** "Use in workbench" link. */
  workbench?: string
  /** "Open in shot groups" link. */
  groups?: string
  /** "Open in designer" link. */
  design?: string
  /** The figure section; a record whose values carry their own figures (the cartridge's) has none. */
  figure?: ReactNode
  /** The values section: the record's table. */
  values: ReactNode
  /** The side column: coefficients, notes. */
  side?: ReactNode
  provenance: Provenance
}) {
  return (
    <div className={`record record-frame${className ? ` ${className}` : ''}`}>
      <PageBar
        title={title}
        after={
          badgeNodes ??
          badges.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <MutedBadge key={i} className="record-badge">
              {b}
            </MutedBadge>
          ))
        }
        actions={
          <RecordActions compare={compare} workbench={workbench} groups={groups} design={design} />
        }
      />
      {/* below 75em the bar has no room beside the title: the same facts as a line under it */}
      {badges.length > 0 && (
        <p className="record-facts">
          {badges.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <span key={i}>{i < badges.length - 1 ? `${b} · ` : b}</span>
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
          title={`Sources (${provenance.kind})`}
          className="record-sources"
        >
          <Sources provenance={provenance} />
        </Panel>
      </div>
    </div>
  )
}
