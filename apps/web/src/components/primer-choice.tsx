'use client'

import { NativeSelect } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import type { PrimerSummary } from '../lib/api-types.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { titleFromKebab } from '../lib/record-fields.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'

/**
 * The primer picker of the workbench: every primer product of the catalogue, the load names the
 * chosen one. `id` is the chosen primer's record id; one the list lacks stays chosen under a
 * generic label, so a saved reference is never dropped.
 */
export function PrimerChoice({
  id,
  onChange,
}: {
  id: string | undefined
  onChange: (id: string | undefined) => void
}) {
  const { t } = useTranslation()
  const names = useManufacturerNames()
  const [items, setItems] = useState<PrimerSummary[]>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const all: PrimerSummary[] = []
    const page = async (offset: number): Promise<void> => {
      const query = new URLSearchParams({ limit: '200', offset: String(offset) })
      const res = await apiFetch(`primers?${query}`, { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { items: PrimerSummary[]; total: number }
      all.push(...body.items)
      if (all.length < body.total && body.items.length > 0) return page(all.length)
    }
    page(0)
      .then(() => {
        if (!signal.aborted) setItems(all)
      })
      .catch(() => {
        if (!signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])
  const listed = items ?? []
  if (listed.length === 0 && !id) return null
  const unlisted = items === undefined ? t('Loading') : t('A primer not in the catalogue')
  return (
    <NativeSelect
      label={t('Primer')}
      value={id ?? ''}
      onChange={(e) => onChange(e.currentTarget.value || undefined)}
      data={[
        { value: '', label: t('None') },
        ...(id && !listed.some((p) => p.id === id)
          ? [{ value: id, label: failed ? t('A primer (catalogue unavailable)') : unlisted }]
          : []),
        ...listed.map((p) => ({
          value: p.id,
          label: `${productLabel(p, names)}, ${titleFromKebab(p.size).toLowerCase()}`,
        })),
      ]}
    />
  )
}
