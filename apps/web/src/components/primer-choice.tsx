'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { productLabel } from '../lib/manufacturers.ts'
import type { PrimerRow } from '../lib/primer-rows.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { RecordSearch, useChooser } from './record-search.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { notReached } from './workbench-outcome.ts'

const PrimerChooser = dynamic(() => import('./record-choosers.tsx').then((m) => m.PrimerChooser), {
  ssr: false,
})

/**
 * The primer picker of the workbench's pinned row: every primer product of the catalogue in the
 * field and the dialog, the load names the chosen one. `id` is the chosen primer's record id; one
 * the list lacks stays chosen under a generic label, so a saved reference is never dropped.
 */
export function PrimerChoice({
  id,
  onChange,
  system,
}: {
  id: string | undefined
  onChange: (id: string | undefined) => void
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const names = useManufacturerNames()
  const dialog = useChooser()
  const [items, setItems] = useState<PrimerRow[]>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    import('../lib/record-choosers.ts')
      .then((m) => m.fetchPrimerCatalogue())
      .then(
        (rows) => live && setItems(rows),
        () => live && setFailed(true),
      )
    return () => {
      live = false
    }
  }, [])
  const find = useMemo(
    () => async (text: string, limit: number) => {
      const { listMatches, primerKeys } = await import('../lib/record-choosers.ts')
      return listMatches(items ?? [], text, limit, primerKeys)
    },
    [items],
  )
  const listed = items ?? []
  if (listed.length === 0 && !id) return null
  const describe = (p: PrimerRow) =>
    `${productLabel(p, names)}, ${titleFromKebab(p.size).toLowerCase()}`
  const chosen = listed.find((p) => p.id === id)
  const unlisted = items === undefined ? t('Loading') : t('A primer not in the catalogue')
  return (
    <>
      <RecordSearch<PrimerRow>
        size={controlSize.row.input}
        chevron
        label={t('Primer')}
        picked={!!id}
        chosen={
          chosen
            ? describe(chosen)
            : id
              ? failed
                ? t('A primer (catalogue unavailable)')
                : unlisted
              : t('Search primers (optional)')
        }
        describe={describe}
        onSelect={(p) => onChange(p.id)}
        noneText={t('No primer found')}
        unreachableText={t(notReached)}
        find={find}
        browse={{ label: t('Browse primers'), onOpen: dialog.open }}
        clear={{ label: t('Clear the primer'), onClear: () => onChange(undefined) }}
      />
      <PrimerChooser
        opened={dialog.opened}
        onClose={dialog.close}
        text={dialog.text}
        system={system}
        onChoose={(p) => {
          onChange(p.id)
          dialog.close()
        }}
      />
    </>
  )
}
