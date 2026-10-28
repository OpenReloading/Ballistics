'use client'

import { TextInput } from '@mantine/core'
import { MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { controlSize } from '../lib/theme.ts'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'

/**
 * The cartridges a bullet fits by their CIP values (`fitsOf` in `bullet-fit.ts`), by name, with a
 * filter over the names; nothing when none.
 */
export function BulletCartridges({ fits }: { fits: { id: string; name: string }[] }) {
  const [q, setQ] = useState('')
  const { t } = useTranslation()
  if (fits.length === 0) return null
  const needle = q.trim().toLowerCase()
  const shown = needle ? fits.filter((c) => c.name.toLowerCase().includes(needle)) : fits
  return (
    <Panel
      id="record-cartridges"
      title={msg('Cartridges')}
      translated
      className="bullet-cartridges"
    >
      <TextInput
        className="field-search"
        type="search"
        size={controlSize.row.input}
        aria-label={t('Filter the cartridges')}
        placeholder={t('Filter cartridges')}
        leftSection={<MagnifyingGlass aria-hidden="true" />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
      />
      <ScrollRegion label={t('Cartridge list')}>
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
        <p className="record-note">{t('No cartridge matches {query}.', { query: q.trim() })}</p>
      )}
    </Panel>
  )
}
