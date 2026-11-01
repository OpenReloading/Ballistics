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
import { useTranslation } from '../i18n/language.ts'
import { rowNotes, rowParts, type StripItem } from '../lib/record-fields.ts'
import { say, type Wording } from '../lib/wording.ts'
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

/** The strip items as cards: items in a row with the same icon share one (a bullet's BCs G1 and G7). */
const cards = (items: StripItem[]) =>
  items.reduce<StripItem[][]>((all, i) => {
    const last = all.at(-1)
    if (last?.[0]?.icon === i.icon) last.push(i)
    else all.push([i])
    return all
  }, [])

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
  tags?: Wording[]
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  if (items.length === 0 && !country && tags.length === 0) return null
  return (
    <FactCards>
      {cards(items).map((card) => (
        <FactCard key={card[0]?.icon} icon={icons[card[0]?.icon ?? 'form']}>
          {card.map((i) => {
            const now = rowParts(i.row, system, t)
            const also = slotUnits.map((u) => rowParts(i.row, u, t))
            return (
              <Fact
                key={i.label}
                label={i.words ? say(t, i.words) : i.label}
                notes={rowNotes(i.row, t)}
                unit={{ now: now.unit, also: also.map((p) => p.unit) }}
              >
                <Sized
                  now={<span className="fact-number">{now.number}</span>}
                  also={also.map((p) => p.number)}
                />
              </Fact>
            )
          })}
        </FactCard>
      ))}
      {country && (
        <FactCard icon={Globe}>
          <Fact label={t('Country')} notes={[t('Country of the manufacturer')]}>
            <Countries items={[country]} as="span" />
          </Fact>
        </FactCard>
      )}
      {tags.length > 0 && (
        <div className="fact-tags">
          {tags.map((tag, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two facts can read the same
            <MutedBadge key={i}>{say(t, tag)}</MutedBadge>
          ))}
        </div>
      )}
    </FactCards>
  )
}
