import { useLingui } from '@lingui/react'
import { TextInput } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTypedBeforeHydration } from '../lib/use-typed-before-hydration.ts'
import { PlaceholderPage } from './-placeholder.tsx'

export const Route = createFileRoute('/workbench')({ component: WorkbenchPage })

function WorkbenchPage() {
  const { i18n } = useLingui()
  const [notes, setNotes] = useState('')
  useTypedBeforeHydration({ notes: setNotes })
  return (
    <>
      <PlaceholderPage />
      <TextInput
        name="notes"
        label={i18n._({ id: 'workbench.notes', message: 'Notes' })}
        value={notes}
        onChange={(event) => setNotes(event.currentTarget.value)}
      />
    </>
  )
}
