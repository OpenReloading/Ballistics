'use client'

import { Anchor, Button } from '@mantine/core'
import { Info, Question, Warning } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { howCloseGuide } from '../lib/docs-url.ts'
import { controlSize } from '../lib/theme.ts'
import type { ResultNotesDialog } from './result-notes-dialog.tsx'
import { useScrolls } from './states.tsx'
import { useResult } from './workbench-context.ts'
import { type NoteKind, type Outcome, resultNotes } from './workbench-outcome.ts'

/** The icon and word of each kind, so colour is never the only cue, and its group's heading. */
export const noteLooks: Record<
  NoteKind,
  { word: ReturnType<typeof msg>; group: ReturnType<typeof msg>; Icon: typeof Info }
> = {
  warning: { word: msg('Warning'), group: msg('Warnings'), Icon: Warning },
  message: { word: msg('Message'), group: msg('Messages'), Icon: Question },
  note: { word: msg('Note'), group: msg('result\u0004Notes'), Icon: Info },
}

/**
 * The notes of the shown result in a box of fixed height, so a step, an input or the units that
 * change them move nothing below. Its list scrolls; More opens every entry with its reason (and the
 * guide on how close a result is, linked in its place when there is no More).
 */
export function ResultNotes({ ok }: { ok: Extract<Outcome, { kind: 'ok' }> }) {
  const { warnings, system } = useResult()
  const { t, tn } = useTranslation()
  const notes = resultNotes(ok, warnings ?? [], system, t)
  const { ref, scrolls } = useScrolls()
  const more = useRef<HTMLButtonElement>(null)
  const [Dialog, setDialog] = useState<typeof ResultNotesDialog>()
  const [open, setOpen] = useState(false)
  const first = notes[0]
  const hasMore = scrolls || notes.some((n) => n.text)
  return (
    <fieldset aria-label={t('Result notes')} className="result-notes screen-only">
      {/* the count and the most important entry, announced when a run brings a new warning */}
      <p className="visually-hidden" role={ok.announce ? 'status' : undefined}>
        {first &&
          `${tn(notes.length, '{count} result note', '{count} result notes')}: ${t(noteLooks[first.kind].word)}: ${first.line}`}
      </p>
      <ul ref={ref} tabIndex={scrolls ? 0 : undefined} aria-label={t('Result notes')}>
        {notes.length === 0 && (
          <li className="result-notes-none">{t('No notes for this result.')}</li>
        )}
        {notes.map((n) => {
          const { word, Icon } = noteLooks[n.kind]
          return (
            <li key={`${n.kind}:${n.line}`} data-kind={n.kind}>
              <Icon size={14} aria-hidden="true" />
              <span className="message-label">{t(word)}:</span> {n.line}
            </li>
          )
        })}
      </ul>
      {/* More and the guide link share one cell as wide as the wider, the other hidden: a swap
          between them changes no width, so the list cannot start and stop scrolling over it */}
      <div className="result-notes-control">
        <Button
          ref={more}
          data-hidden={hasMore ? undefined : true}
          variant="default"
          size={controlSize.row.button}
          aria-haspopup="dialog"
          onClick={() =>
            // a plain import() on first open: next/dynamic would count the dialog in the route's weight
            Dialog
              ? setOpen(true)
              : import('./result-notes-dialog.tsx').then((m) => {
                  setDialog(() => m.ResultNotesDialog)
                  setOpen(true)
                })
          }
        >
          {t('More ({count})', { count: notes.length })}
        </Button>
        {/* without More the dialog that links the guide is out of reach: the link in its place */}
        {howCloseGuide && (
          <Anchor
            data-hidden={hasMore ? true : undefined}
            href={howCloseGuide}
            target="_blank"
            rel="noopener"
            size="sm"
          >
            {t('How close a result is')}
          </Anchor>
        )}
      </div>
      {Dialog && (
        <Dialog
          notes={notes}
          opened={open}
          onClose={() => {
            setOpen(false)
            // the dialog mounts already open on first use, so it has no button to return to
            more.current?.focus()
          }}
        />
      )}
    </fieldset>
  )
}
