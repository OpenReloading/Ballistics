import { useLingui } from '@lingui/react'
import { TextInput } from '@mantine/core'
import { Search } from 'lucide-react'
import { useState } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { controlSize } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/bullet-cartridges.json' with { type: 'json' }
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'

loadEnglish(englishMessages)

/** The cartridges the bullet fits by their CIP values (`fitsOf` in `bullet-fit.ts`); nothing when none. */
export function BulletCartridges({ fits }: { fits: { id: string; name: string }[] }) {
  const [q, setQ] = useState('')
  const { i18n } = useLingui()
  if (fits.length === 0) return null
  const needle = q.trim().toLowerCase()
  const shown = needle ? fits.filter((c) => c.name.toLowerCase().includes(needle)) : fits
  return (
    <Panel
      id="record-cartridges"
      title={/*i18n*/ { id: 'bulletRecord.cartridges', message: 'Cartridges' }}
      translated
      className="bullet-cartridges"
    >
      <TextInput
        className="field-search"
        type="search"
        size={controlSize.row.input}
        aria-label={i18n._({ id: 'bulletRecord.filterLabel', message: 'Filter the cartridges' })}
        placeholder={i18n._({ id: 'bulletRecord.filter', message: 'Filter cartridges' })}
        leftSection={<Search aria-hidden="true" />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <ScrollRegion label={i18n._({ id: 'bulletRecord.cartridgeList', message: 'Cartridge list' })}>
        <ul aria-labelledby="record-cartridges">
          {fits.map((c) => (
            // left out by the filter on screen, printed
            <li key={c.id} data-off={shown.includes(c) ? undefined : true}>
              <Link href={`/cartridges/${encodeURIComponent(c.id)}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      </ScrollRegion>
      {shown.length === 0 && (
        <p className="record-note">
          {i18n._({
            id: 'bulletRecord.noCartridge',
            message: 'No cartridge matches {query}.',
            values: { query: q.trim() },
          })}
        </p>
      )}
    </Panel>
  )
}
