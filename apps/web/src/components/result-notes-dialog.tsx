'use client'

import { Anchor } from '@mantine/core'
import { useTranslation } from '../i18n/language.ts'
import { howCloseGuide } from '../lib/docs-url.ts'
import { AppModal } from './app-modal.tsx'
import { noteLooks } from './result-notes.tsx'
import { noteKinds, type ResultNote } from './workbench-outcome.ts'

/** Every note of the shown result in full, grouped by kind, each with its reason. */
export function ResultNotesDialog({
  notes,
  opened,
  onClose,
}: {
  notes: ResultNote[]
  opened: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <AppModal opened={opened} onClose={onClose} title={t('Result notes')} size="lg">
      {noteKinds.map((kind) => {
        const group = notes.filter((n) => n.kind === kind)
        if (group.length === 0) return null
        const { group: heading, Icon } = noteLooks[kind]
        return (
          <section key={kind} className="result-notes-group" data-kind={kind}>
            <h3>
              <Icon size={16} aria-hidden="true" />
              {t(heading)} ({group.length})
            </h3>
            <ul>
              {group.map((n) => (
                <li key={n.line}>
                  <strong>{n.line}</strong>
                  {n.text && <p className="result-note-reason">{n.text}</p>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {howCloseGuide && (
        <p className="note">
          <Anchor href={howCloseGuide} target="_blank" rel="noopener" size="sm">
            {t('How close a result is')}
          </Anchor>
        </p>
      )}
    </AppModal>
  )
}
