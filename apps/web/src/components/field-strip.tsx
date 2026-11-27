import type { I18n } from '@lingui/core'
import { useLingui } from '@lingui/react'
import {
  Box,
  Circle,
  CircleDot,
  Cylinder,
  Droplet,
  Factory,
  Flag,
  Flame,
  Globe,
  type LucideIcon,
  Package,
  Ruler,
  Scale,
  Shapes,
  Target,
  TrendingDown,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { loadEnglish } from '../i18n/lingui.ts'
import { rowNotes, rowParts, type StripItem } from '../lib/record-fields.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { type LinguiWording, sayLingui } from '../lib/wording.ts'
import englishMessages from '../locales/en/components/field-strip.json' with { type: 'json' }
import { Countries } from './countries.tsx'
import { Fact, FactCard, FactCards, Sized, slotUnits } from './fact-cards.tsx'
import { MutedBadge } from './standard-badge.tsx'
import { useUnits } from './units-settings.tsx'

loadEnglish(englishMessages)

const icons: Record<StripItem['icon'], LucideIcon> = {
  manufacturer: Factory,
  diameter: Circle,
  mass: Scale,
  length: Ruler,
  ballisticCoefficient: TrendingDown,
  sectionalDensity: Cylinder,
  form: Shapes,
  burnRate: Flame,
  base: Droplet,
  density: Box,
  bulkDensity: Package,
  capacity: Droplet,
  material: Box,
  federation: Flag,
  distance: Ruler,
  rings: Target,
  black: CircleDot,
}

/** A strip item's label; a coefficient of a velocity band names its lower bound, as the table does. */
function stripLabel(i: StripItem, system: UnitSystem, i18n: I18n) {
  const label = i.words ? sayLingui(i18n, i.words) : i.label
  return i.row.fromVelocity === undefined
    ? label
    : i18n._({
        id: 'fieldStrip.bandFrom',
        message: '{label} from {velocity}',
        values: { label, velocity: withUnit('velocity', system, i.row.fromVelocity) },
      })
}

/** The strip items as cards: items in a row with the same icon share one (a bullet's BCs G1 and G7). */
const cards = (items: StripItem[]) =>
  items.reduce<StripItem[][]>((all, i) => {
    const last = all.at(-1)
    if (last?.[0]?.icon === i.icon) last.push(i)
    else all.push([i])
    return all
  }, [])

/** As the cartridge record's cards: values in the Settings units, `children` the page's own cards, `tags` badges at the right end from 48em. */
export function FieldStrip({
  items,
  country,
  tags = [],
  children,
}: {
  items: StripItem[]
  country?: { name: string; code?: string | undefined } | undefined
  tags?: LinguiWording[]
  children?: ReactNode
}) {
  const { i18n } = useLingui()
  const { system } = useUnits()
  if (items.length === 0 && !country && tags.length === 0 && !children) return null
  return (
    <FactCards>
      {cards(items).map((card) => (
        <FactCard key={card[0]?.icon} icon={icons[card[0]?.icon ?? 'form']}>
          {card.map((i) => {
            const now = rowParts(i.row, system, i18n)
            const also = slotUnits.map((u) => rowParts(i.row, u, i18n))
            return (
              <Fact
                key={i.label}
                label={stripLabel(i, system, i18n)}
                notes={rowNotes(i.row, i18n)}
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
          <Fact
            label={i18n._({ id: 'fieldStrip.country', message: 'Country' })}
            notes={[
              i18n._({ id: 'fieldStrip.countryNote', message: 'Country of the manufacturer' }),
            ]}
          >
            <Countries items={[country]} as="span" />
          </Fact>
        </FactCard>
      )}
      {children}
      {tags.length > 0 && (
        <div className="fact-tags">
          {tags.map((tag, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- two facts can read the same
            <MutedBadge key={i}>{sayLingui(i18n, tag)}</MutedBadge>
          ))}
        </div>
      )}
    </FactCards>
  )
}
