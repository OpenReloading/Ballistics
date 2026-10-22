import { Badge } from '@mantine/core'
import type { ReactNode } from 'react'

/** The standard as text in an outlined badge; the colour (`--standard-cip`) only repeats it. */
export function StandardBadge({ label }: { label: string }) {
  const tone = label === 'CIP' ? 'cip' : 'other'
  return (
    <Badge
      component="span"
      variant="outline"
      tt="none"
      color={`var(--standard-${tone}, var(--fg))`}
      className="standard-badge"
    >
      {label}
    </Badge>
  )
}

/** A record fact as a quiet badge: line, caliber, product number, the gap mark. */
export function MutedBadge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Badge component="span" variant="light" size="sm" color="gray" tt="none" className={className}>
      {children}
    </Badge>
  )
}

/** The mark of a cartridge record without values (no dimensions, no pressures), as the record pages' badges. */
export function GapBadge() {
  return <MutedBadge className="gap-badge">Gap</MutedBadge>
}
