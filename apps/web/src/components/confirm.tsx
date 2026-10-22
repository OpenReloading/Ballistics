'use client'

import { Affix, Button, Group, Notification, Text } from '@mantine/core'
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { controlSize } from '../lib/theme.ts'
import { AppModal } from './app-modal.tsx'
import { useRoute } from './use-route.ts'

type Ask = {
  title: string
  message?: ReactNode
  /** The label of the button that goes ahead, a verb: Delete, Replace, Leave. */
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}
type Pending = Ask & { resolve: (ok: boolean) => void }
type Offer = { text: string; undo: () => unknown; n: number }

let queue: Pending[] = []
let offer: Offer | undefined
let n = 0
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/**
 * The app's confirm dialog, callable from handlers and effects: true on the confirm button,
 * false on Cancel, Escape or a click outside. Questions asked together are shown one after another.
 */
export function confirmDialog(ask: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...ask, resolve }]
    emit()
  })
}

/** A notice with Undo after a delete that can be taken back; a later one replaces it. Its number. */
export function offerUndo(text: string, undo: () => unknown) {
  offer = { text, undo, n: ++n }
  emit()
  return n
}

/** Whether the notice numbered `k` still shows. */
export const offered = (k: number) => offer?.n === k

const shownMs = 10_000

/** Answers `q`; a question answered already (a second click while it fades) is left alone. */
const answer = (q: Pending | undefined, ok: boolean) => {
  if (!q || !queue.includes(q)) return
  queue = queue.filter((x) => x !== q)
  emit()
  q.resolve(ok)
}

const close = (o: Offer) => {
  if (offer !== o) return
  offer = undefined
  emit()
}

/** Renders the confirm dialog and the undo notice; mounted once in the providers. */
export function ConfirmHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => queue[0],
    () => undefined,
  )
  const notice = useSyncExternalStore(
    subscribe,
    () => offer,
    () => undefined,
  )
  // the question shown: kept while it fades after its answer, the next one shown after that, so
  // a double click or a held Enter answers one question only
  const [shown, setShown] = useState<Pending>()
  if (!shown && current) setShown(current)
  const open = shown !== undefined && shown === current
  const showing = useRef(shown)
  showing.current = shown

  // Escape answers the question only, not a dialog under it (each Mantine modal closes on any
  // Escape of the window): this listener is added first, as the host renders before the page
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing || !queue.length) return
      e.stopImmediatePropagation()
      e.preventDefault()
      answer(showing.current, false)
    }
    window.addEventListener('keydown', onEscape, { capture: true })
    return () => window.removeEventListener('keydown', onEscape, { capture: true })
  }, [])

  /** The notice under the pointer or the focus waits; a later notice starts its own time. */
  const [held, setHeld] = useState<number>()
  useEffect(() => {
    if (!notice || held === notice.n) return
    const t = setTimeout(() => close(notice), shownMs)
    return () => clearTimeout(t)
  }, [notice, held])
  // an Undo for a page that is gone would do nothing, and a question of that page is answered no
  const route = useRoute()
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a route change only
  useEffect(() => {
    if (!offer && !queue.length) return
    const asked = queue
    queue = []
    offer = undefined
    emit()
    for (const q of asked) q.resolve(false)
  }, [route])

  return (
    <>
      <AppModal
        opened={open}
        onClose={() => answer(shown, false)}
        onExitTransitionEnd={() => setShown(undefined)}
        closeOnEscape={false}
        zIndex={400}
        centered
        closeButton={false}
        title={shown?.title}
      >
        {shown?.message && (
          <Text size="sm" mb="md">
            {shown.message}
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          {/* the safe answer has the focus: Enter keeps what is there */}
          <Button variant="default" data-autofocus onClick={() => answer(shown, false)}>
            {shown?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button color={shown?.danger ? 'red' : undefined} onClick={() => answer(shown, true)}>
            {shown?.confirmLabel}
          </Button>
        </Group>
      </AppModal>
      {/* mounted before any notice, so screen readers announce the text when it comes */}
      <Affix position={{ bottom: 16, right: 16 }} zIndex={300}>
        <div role="status">
          {notice && (
            <Notification
              key={notice.n}
              // the live region is the box around it; Mantine's default role is alert
              role="presentation"
              withCloseButton
              closeButtonProps={{ 'aria-label': 'Close notice' }}
              onClose={() => close(notice)}
              onMouseEnter={() => setHeld(notice.n)}
              onMouseLeave={() => setHeld(undefined)}
              onFocus={() => setHeld(notice.n)}
              onBlur={() => setHeld(undefined)}
              maw="calc(100vw - 32px)"
            >
              <Group gap="sm" wrap="nowrap">
                <Text size="sm">{notice.text}</Text>
                <Button
                  size={controlSize.row.button}
                  variant="default"
                  onClick={() => {
                    close(notice)
                    notice.undo()
                  }}
                >
                  Undo
                </Button>
              </Group>
            </Notification>
          )}
        </div>
      </Affix>
    </>
  )
}
