'use client'

import { ActionIcon, Button, Group, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import { safety } from '../lib/safety.ts'
import { AppModal } from './app-modal.tsx'
import { NavIcon } from './nav-icons.tsx'

/** Browser storage key of the acceptance; a new value asks again after the text changes. */
const ackKey = 'safety-ack'
const ackValue = '3'
/** Where Decline leads: away from the site to the browser's empty page, naming no other site. */
const declineUrl = 'about:blank'
const openEvent = 'safety-open'

/** Whether this browser has accepted the current text of the notice. */
function isSafetyAccepted() {
  try {
    return localStorage.getItem(ackKey) === ackValue
  } catch {
    return false
  }
}

/** Opens the Safety dialog from anywhere on the page. */
export const openSafety = () => window.dispatchEvent(new Event(openEvent))

/**
 * The README Safety text as a disclaimer dialog. On the first visit it must be accepted (no close
 * button, Escape or outside click); Decline leaves the site. `openSafety` shows it again.
 */
export function SafetyDialog() {
  const [opened, setOpened] = useState(false)
  const [required, setRequired] = useState(false)
  useEffect(() => {
    if (!isSafetyAccepted()) {
      setRequired(true)
      setOpened(true)
    }
    const open = () => setOpened(true)
    window.addEventListener(openEvent, open)
    return () => window.removeEventListener(openEvent, open)
  }, [])
  const accept = () => {
    try {
      localStorage.setItem(ackKey, ackValue)
    } catch {}
    setRequired(false)
    setOpened(false)
  }
  const decline = () => {
    try {
      localStorage.removeItem(ackKey)
    } catch {}
    window.location.replace(declineUrl)
  }
  return (
    <AppModal
      opened={opened}
      onClose={() => !required && setOpened(false)}
      size="lg"
      centered
      closeOnEscape={!required}
      closeOnClickOutside={!required}
      className="safety-dialog"
      closeButton={false}
      // only the text scrolls: the answers stay in view below it on a short phone screen
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' },
      }}
      title={
        <>
          <NavIcon name="safety" /> Safety notice and disclaimer
        </>
      }
      // the first focus: on the text, not on a button that Enter would press; focusable so the
      // keys scroll it
      bodyProps={{ tabIndex: 0, 'data-autofocus': true, className: 'safety-text' }}
      footer={
        <Group justify="flex-end" p="md">
          <Button variant="default" onClick={decline}>
            Decline
          </Button>
          <Button color="yellow" c="dark" onClick={accept}>
            I accept
          </Button>
        </Group>
      }
    >
      <p>{safety.intro}</p>
      <ul>
        {safety.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>{safety.outro}</p>
      <p>By selecting I accept you confirm that you have read and understood this notice.</p>
    </AppModal>
  )
}

/**
 * The yellow Safety button of the top bar (light yellow: the caution
 * tokens of `.safety-light` in globals.css, about 8:1): labelled with its icon in the page bar from
 * 75em, icon only in the phone top bar; screen only.
 */
export function SafetyBarButton({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean | undefined
  className?: string | undefined
}) {
  const icon = <NavIcon name="safety" />
  return iconOnly ? (
    <Tooltip label="Safety">
      <ActionIcon
        color="yellow"
        variant="light"
        className={`safety-light screen-only ${className ?? ''}`}
        aria-label="Safety notice"
        onClick={openSafety}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  ) : (
    <Button
      color="yellow"
      variant="light"
      leftSection={icon}
      className="page-bar-safety safety-light screen-only"
      aria-label="Safety notice"
      onClick={openSafety}
    >
      Safety
    </Button>
  )
}
