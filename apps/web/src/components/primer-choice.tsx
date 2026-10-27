'use client'

import { NativeSelect } from '@mantine/core'
import { useEffect, useState } from 'react'
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
  const names = useManufacturerNames()
  const [items, setItems] = useState<PrimerSummary[]>()
  useEffect(() => {
    const controller = new AbortController()
    apiFetch(`primers?${new URLSearchParams({ limit: '200' })}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as { items: PrimerSummary[] }
        if (!controller.signal.aborted) setItems(body.items)
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([])
      })
    return () => controller.abort()
  }, [])
  const listed = items ?? []
  if (listed.length === 0 && !id) return null
  return (
    <NativeSelect
      label="Primer"
      value={id ?? ''}
      onChange={(e) => onChange(e.currentTarget.value || undefined)}
      data={[
        { value: '', label: 'None' },
        ...(id && !listed.some((p) => p.id === id)
          ? [{ value: id, label: 'A primer not in the catalogue' }]
          : []),
        ...listed.map((p) => ({
          value: p.id,
          label: `${productLabel(p, names)}, ${titleFromKebab(p.size).toLowerCase()}`,
        })),
      ]}
    />
  )
}
