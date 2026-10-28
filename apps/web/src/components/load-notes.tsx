'use client'

import { Button, TextInput } from '@mantine/core'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { noteText } from '../lib/load-notes.ts'
import { controlSize } from '../lib/theme.ts'
import { Message } from './states.tsx'
import { useResult } from './workbench-context.ts'

const lotFields = [
  ['powder', msg('Powder lot')],
  ['primer', msg('Primer lot')],
  ['case', msg('Case lot')],
] as const

/** The lot numbers of the load, saved with it and kept with each chronograph session. */
export function LoadLots() {
  const { t } = useTranslation()
  const {
    loadNotes: { lots, setLots },
  } = useResult()
  return (
    <fieldset className="load-lots">
      <legend>{t('Lots')}</legend>
      <div className="field-row">
        {lotFields.map(([key, label]) => (
          <TextInput
            key={key}
            label={t(label)}
            value={lots[key]}
            maxLength={200}
            onChange={(e) => setLots({ ...lots, [key]: e.currentTarget.value })}
          />
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The notes of the load's sessions, or of `session` (a reference) alone. Each names the values it
 * compares and the sessions they come from; a note is dismissed for its session.
 */
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
