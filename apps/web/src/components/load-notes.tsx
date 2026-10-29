'use client'

import { Button, TextInput } from '@mantine/core'
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
} as const

/**
 * One lot of the load. The Notes tab and the place beside the component's choice show the same
 * value: `short` labels it Lot (the choice beside it names the component), `bare` gives it no
 * label and Lot in the field before the value; the accessible name is the full one in either case.
 */
export function LotField({ lot, short, bare }: { lot: keyof Lots; short?: true; bare?: true }) {
  const { t } = useTranslation()
  const {
    loadNotes: { lots, setLots },
  } = useLoad()
  return (
    <TextInput
      className={short || bare ? 'lot-field' : undefined}
      {...(short || bare ? { size: controlSize.row.input } : {})}
      label={bare ? undefined : t(short ? 'Lot' : lotLabels[lot])}
      aria-label={t(lotLabels[lot])}
      {...(bare ? { leftSection: t('Lot'), leftSectionWidth: '2rem' } : {})}
      value={lots[lot]}
      maxLength={200}
      onChange={(e) => setLots({ ...lots, [lot]: e.currentTarget.value })}
    />
  )
}

/** The lot numbers of the load, saved with it and kept with each chronograph session. */
export function LoadLots() {
  const { t } = useTranslation()
  return (
    <fieldset className="load-lots">
      <legend>{t('Lots')}</legend>
      <div className="field-row">
        {(['powder', 'primer', 'case'] as const).map((lot) => (
          <LotField key={lot} lot={lot} />
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
