import { Button, TextInput } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { type Lots, noteText } from '../lib/load-notes.ts'
import { controlSize } from '../lib/theme.ts'
import { Message } from './states.tsx'
import { useLoad, useResult } from './workbench-context.ts'

const lotLabels = {
  powder: msg('Powder lot'),
  primer: msg('Primer lot'),
  case: msg('Case lot'),
  bullet: msg('Bullet lot'),
} as const

const addLabels = {
  powder: msg('Add lot for the powder'),
  primer: msg('Add lot for the primer'),
  case: msg('Add lot for the case'),
  bullet: msg('Add lot for the bullet'),
} as const

/** The lot under its component's record choice: an empty one stays behind Add lot until asked for; the field says Lot, its accessible name the full one. */
export function LotField({ lot }: { lot: keyof Lots }) {
  const { t } = useTranslation()
  const {
    loadNotes: { lots, setLots },
  } = useLoad()
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // the field Add lot opens takes the focus; one shown for a lot already set does not
  const added = useRef(false)
  useEffect(() => {
    if (!open || !added.current) return
    added.current = false
    input.current?.focus()
  }, [open])
  if (!open && !lots[lot].trim())
    return (
      <div className="lot-row">
        <Button
          className="lot-add"
          variant="subtle"
          size={controlSize.row.button}
          leftSection={<Plus size={14} aria-hidden="true" />}
          aria-label={t(addLabels[lot])}
          onClick={() => {
            added.current = true
            setOpen(true)
          }}
        >
          {t('Add lot')}
        </Button>
      </div>
    )
  return (
    <div className="lot-row">
      <TextInput
        ref={input}
        className="lot-field"
        size={controlSize.row.input}
        aria-label={t(lotLabels[lot])}
        leftSection={t('Lot')}
        leftSectionWidth="2.25rem"
        value={lots[lot]}
        maxLength={200}
        onChange={(e) => setLots({ ...lots, [lot]: e.currentTarget.value })}
        // kept open while focused, so clearing a lot to retype it keeps the field
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
    </div>
  )
}

/** The lot numbers of the load, saved with it and kept with each chronograph session; every one shows here, set or not. */
export function LoadLots() {
  const { t } = useTranslation()
  const {
    loadNotes: { lots, setLots },
  } = useLoad()
  return (
    <fieldset className="load-lots">
      <legend>{t('Lots')}</legend>
      <div className="field-row">
        {(['powder', 'primer', 'case', 'bullet'] as const).map((lot) => (
          <TextInput
            key={lot}
            label={t(lotLabels[lot])}
            value={lots[lot]}
            maxLength={200}
            onChange={(e) => setLots({ ...lots, [lot]: e.currentTarget.value })}
          />
        ))}
      </div>
    </fieldset>
  )
}

/** `session` (a reference) shows that session's alone; a note is dismissed for its session. */
export function SessionNotes({ session }: { session?: string }) {
  const { t } = useTranslation()
  const { loadNotes, system } = useResult()
  const notes = loadNotes.notes.filter((n) => session === undefined || n.session === session)
  if (notes.length === 0) return null
  return (
    <div className="session-notes">
      {notes.map((n) => (
        <Message key={`${n.session} ${n.rule}`} severity="info" announce={false}>
          {noteText(n, loadNotes.sessionName, system, t)}
          <Button
            display="block"
            variant="default"
            mt="xs"
            size={controlSize.row.button}
            aria-label={t('Dismiss the note on {session}: {rule}', {
              session: loadNotes.sessionName(n.session),
              rule: n.rule,
            })}
            onClick={() => loadNotes.dismiss(n.session, n.rule)}
          >
            {t('Dismiss')}
          </Button>
        </Message>
      ))}
    </div>
  )
}
