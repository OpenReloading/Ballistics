'use client'

import {
  Circle,
  Cube,
  Cylinder,
  Drop,
  Factory,
  Flag,
  Flame,
  Globe,
  type Icon,
  Package,
  Record as RecordIcon,
  Ruler,
  Scales,
  Shapes,
  Target,
  TrendDown,
} from '@phosphor-icons/react'
import { rowNotes, rowParts, type StripItem } from '../lib/record-fields.ts'
import { Countries } from './countries.tsx'
import { Fact, FactCard, FactCards, Sized, slotUnits } from './fact-cards.tsx'
import { MutedBadge } from './standard-badge.tsx'
import { useUnits } from './units-settings.tsx'

const icons: Record<StripItem['icon'], Icon> = {
  manufacturer: Factory,
  diameter: Circle,
  mass: Scales,
  length: Ruler,
  ballisticCoefficient: TrendDown,
  sectionalDensity: Cylinder,
  form: Shapes,
  burnRate: Flame,
  base: Drop,
  density: Cube,
  bulkDensity: Package,
  capacity: Drop,
  material: Cube,
  federation: Flag,
  distance: Ruler,
  rings: Target,
  black: RecordIcon,
}

/**
 * A bullet or powder record's facts under the page bar, as the cartridge record's cards: a card
 * per value of `items` in the Settings units, the unit after the label, then the manufacturer's
 * country, then `tags` (line, caliber, product number) as badges at the right end from 48em.
 */
export function FieldStrip({
  items,
  country,
  tags = [],
}: {
  items: StripItem[]
  country?: { name: string; code?: string | undefined } | undefined
  tags?: string[]
}) {
  const { system } = useUnits()
  if (items.length === 0 && !country && tags.length === 0) return null
  return (
    <FactCards>
      {items.map((i) => {
        const now = rowParts(i.row, system)
        const also = slotUnits.map((u) => rowParts(i.row, u))
        return (
          <FactCard key={i.icon} icon={icons[i.icon]}>
            <Fact
              label={i.label}
              notes={rowNotes(i.row)}
              unit={{ now: now.unit, also: also.map((p) => p.unit) }}
            >
              <Sized
                now={<span className="fact-number">{now.number}</span>}
                also={also.map((p) => p.number)}
              />
            </Fact>
          </FactCard>
        )
      })}
      {country && (
        <FactCard icon={Globe}>
          <Fact label="Country" notes={['Country of the manufacturer']}>
            <Countries items={[country]} as="span" />
          </Fact>
        </FactCard>
      )}
      {tags.length > 0 && (
        <div className="fact-tags">
          {tags.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <MutedBadge key={i}>{t}</MutedBadge>
          ))}
        </div>
      )}
    </FactCards>
  )
}
