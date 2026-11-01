'use client'

/** Parts the shooting log and the competition events pages share: the discipline options and a bar button. */
import { Button } from '@mantine/core'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import type { FederationData } from '../lib/face-disciplines.ts'
import { fetchFederationData } from '../lib/face-records.ts'

/** The disciplines of the catalogue as select options, by federation; empty while unreachable. */
export function useDisciplines() {
  const [data, setData] = useState<FederationData>()
  useEffect(() => {
    // unreachable: no discipline to choose, a stored one shows by its id
    fetchFederationData().then(setData, () => {})
  }, [])
  return useMemo(() => {
    const names = new Map<string, string>()
    const groups = new Map<string, { value: string; label: string }[]>()
    const federation = new Map(data?.federations.map((f) => [f.id, f.name]) ?? [])
    for (const d of data?.disciplines ?? []) {
      const label = [d.number, d.name].filter(Boolean).join(' ')
      names.set(`catalogue:${d.id}`, label)
      const group = federation.get(d.federation) ?? d.federation
      groups.set(group, [...(groups.get(group) ?? []), { value: `catalogue:${d.id}`, label }])
    }
    const options = [...groups].map(([group, items]) => ({ group, items }))
    return { options, names }
  }, [data])
}

/** A bar button that says in its title why it does nothing while `nothing` holds a reason. */
export function BarButton({
  nothing,
  onClick,
  children,
}: {
  nothing: string | false
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="default"
      {...(nothing && { 'data-disabled': true, 'aria-disabled': true, title: nothing })}
      onClick={nothing ? undefined : onClick}
    >
      {children}
    </Button>
  )
}
