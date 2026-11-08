import { useLingui } from '@lingui/react'
import { Stack, Textarea, TextInput } from '@mantine/core'
import { PageBar } from '@open-reloading/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useLayoutEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/workbench')({ component: Workbench })

// controlled fields, as the load workbench keeps its inputs in state
function Workbench() {
  const { i18n } = useLingui()
  const [cartridge, setCartridge] = useState('')
  const [charge, setCharge] = useState('')
  const [notes, setNotes] = useState('')
  const form = useRef<HTMLDivElement>(null)
  // text typed before hydration stays in the DOM until the next render writes the state back: take it into the state
  useLayoutEffect(() => {
    const field = (id: string) =>
      form.current?.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)?.value ?? ''
    setCartridge(field('cartridge'))
    setCharge(field('charge'))
    setNotes(field('notes'))
  }, [])
  return (
    <>
      <PageBar title={i18n._({ id: 'workbench.title', message: 'Load workbench' })} />
      <Stack maw={480} ref={form}>
        <TextInput
          label={i18n._({ id: 'workbench.cartridge', message: 'Cartridge' })}
          value={cartridge}
          onChange={(e) => setCartridge(e.currentTarget.value)}
          data-testid="cartridge"
        />
        <TextInput
          label={i18n._({ id: 'workbench.charge', message: 'Charge (gr)' })}
          inputMode="decimal"
          value={charge}
          onChange={(e) => setCharge(e.currentTarget.value)}
          data-testid="charge"
        />
        <Textarea
          label={i18n._({ id: 'workbench.notes', message: 'Notes' })}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          data-testid="notes"
        />
      </Stack>
    </>
  )
}
