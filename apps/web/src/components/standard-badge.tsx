'use client'

import { Badge } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'

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
export function MutedBadge({
  className,
  children,
}: {
  className?: string | undefined
  children: ReactNode
}) {
  return (
    <Badge component="span" variant="light" size="sm" color="gray" tt="none" className={className}>
      {children}
    </Badge>
  )
}

/** The mark of a cartridge record without values (no dimensions, no pressures), as the record pages' badges. */
export function GapBadge() {
  const { t } = useTranslation()
  return <MutedBadge className="gap-badge">{t('Gap')}</MutedBadge>
}
