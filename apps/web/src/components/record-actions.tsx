'use client'

import { useLingui } from '@lingui/react'
import {
  ActionIcon,
  Button,
  type ButtonProps,
  CopyButton,
  Popover,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
  ArrowLeftRight,
  Check,
  Copy,
  FlaskConical,
  Info,
  Link as LinkIcon,
  Pencil,
  Printer,
  Target,
} from 'lucide-react'
import { type ReactNode, useId } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/record-actions.json' with { type: 'json' }
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { TourButton } from './tour-button.tsx'
import { UnitsIconButton } from './units-settings.tsx'

loadEnglish(englishMessages)

/** Drawn as a default Mantine button, or filled as the page's one primary action. */
export function LinkButton({
  href,
  size,
  icon,
  primary,
  className,
  children,
}: {
  href: string
  size?: ButtonProps['size']
  icon?: ReactNode
  primary?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Button
      component={Link}
      href={href}
      variant={primary ? 'filled' : 'default'}
      {...(size && { size })}
      leftSection={icon}
      className={className}
    >
      {children}
    </Button>
  )
}

/** One component, so the record pages' actions cannot drift: each where the record has one, the icon buttons named on hover and focus; the bullet comparison shows the icon buttons alone. */
export function RecordActions({
  compare,
  workbench,
  groups,
  design,
  more,
  tour,
}: {
  compare?: string | undefined
  workbench?: string | undefined
  groups?: string | undefined
  design?: string | undefined
  /** More links after Compare: the powder record's Tune from strings. */
  more?: ReactNode
  /** The Tour button of the record pages. */
  tour?: boolean
}) {
  const { i18n } = useLingui()
  const clipboard = useClipboard({ timeout: 2000 })
  return (
    <>
      {workbench && (
        <LinkButton href={workbench} icon={<FlaskConical aria-hidden="true" />} primary>
          {i18n._({ id: 'recordActions.useInWorkbench', message: 'Use in workbench' })}
        </LinkButton>
      )}
      {groups && (
        <LinkButton href={groups} icon={<Target aria-hidden="true" />} primary>
          {i18n._({ id: 'recordActions.openInShotGroups', message: 'Open in shot groups' })}
        </LinkButton>
      )}
      {design && (
        <LinkButton href={design} icon={<Pencil aria-hidden="true" />}>
          {i18n._({ id: 'recordActions.openInDesigner', message: 'Open in designer' })}
        </LinkButton>
      )}
      {compare && (
        <LinkButton href={compare} icon={<ArrowLeftRight aria-hidden="true" />}>
          {i18n._({ id: 'recordActions.compare', message: 'Compare' })}
        </LinkButton>
      )}
      {more}
      {tour && <TourButton page="record" />}
      <UnitsIconButton />
      {/* the name stays, so a copy moves nothing */}
      <Tooltip
        label={
          clipboard.copied
            ? i18n._({ id: 'recordActions.linkCopied', message: 'Link copied' })
            : i18n._({ id: 'recordActions.copyLink', message: 'Copy link' })
        }
        {...(clipboard.copied && { opened: true })}
      >
        <ActionIcon
          variant="default"
          aria-label={i18n._({ id: 'recordActions.copyLink', message: 'Copy link' })}
          onClick={() => clipboard.copy(window.location.href)}
        >
          <LinkIcon aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
      <CopyStatus copied={clipboard.copied} error={clipboard.error} />
      <PrintButton />
    </>
  )
}

/** Hidden live region beside a Copy link button: says the result of a copy, empty otherwise. */
export function CopyStatus({ copied, error }: { copied: boolean; error: Error | null }) {
  const { i18n } = useLingui()
  return (
    <span role="status" className="visually-hidden">
      {copied
        ? i18n._({ id: 'recordActions.linkCopied', message: 'Link copied' })
        : error
          ? i18n._({ id: 'recordActions.copyFailed', message: 'Copy failed' })
          : ''}
    </span>
  )
}

/** Its name (or `hint`, what the print holds) on hover and focus, as the bars' other icon actions. */
export function PrintButton({
  onClick = () => window.print(),
  disabled,
  hint,
}: {
  onClick?: () => void
  /** Why nothing prints yet, shown as the tooltip; the button stays focusable, so it is read. */
  disabled?: string | false | undefined
  hint?: string
}) {
  const { i18n } = useLingui()
  const why = useId()
  const label = disabled || hint
  return (
    <>
      <Tooltip
        label={label ?? i18n._({ id: 'recordActions.print', message: 'Print' })}
        multiline={!!label}
        maw={label ? 320 : undefined}
      >
        <ActionIcon
          variant="default"
          aria-label={i18n._({ id: 'recordActions.print', message: 'Print' })}
          // aria-disabled, not disabled: a disabled button shows no tooltip and takes no focus
          {...(disabled && {
            'data-disabled': true,
            'aria-disabled': true,
            'aria-describedby': why,
          })}
          onClick={disabled ? undefined : onClick}
        >
          <Printer aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
      {disabled && (
        <span id={why} className="visually-hidden">
          {disabled}
        </span>
      )}
    </>
  )
}

/** Hex digits of a SHA-256 shown on screen; the rest is in the tooltip and in print. */
const shortDigits = 12

/** A source file's hash, short, as a button that copies it; the full value on hover or focus. */
export function CopyHash({ hash }: { hash: string }) {
  const { i18n } = useLingui()
  return (
    <span className="hash">
      SHA-256{' '}
      <CopyButton value={hash} timeout={2000}>
        {({ copied, copy }) => (
          <Tooltip
            label={copied ? i18n._({ id: 'recordActions.copied', message: 'Copied' }) : hash}
            events={tipEvents}
            multiline
            classNames={{ tooltip: 'hash-tooltip' }}
          >
            <UnstyledButton
              className="hash-copy"
              aria-label={
                copied
                  ? i18n._({ id: 'recordActions.hashCopied', message: 'Hash copied' })
                  : i18n._({
                      id: 'recordActions.copyHash',
                      message: 'Copy hash {hash}',
                      values: { hash: hash.slice(0, shortDigits) },
                    })
              }
              onClick={copy}
            >
              {/* the rest stays in the text for print */}
              <code>
                {hash.slice(0, shortDigits)}
                <span className="hash-rest">{hash.slice(shortDigits)}</span>
              </code>
              {copied ? (
                <Check aria-hidden="true" className="screen-only" />
              ) : (
                <Copy aria-hidden="true" className="screen-only" />
              )}
            </UnstyledButton>
          </Tooltip>
        )}
      </CopyButton>
    </span>
  )
}

/** A drawing's legend and assumptions behind a button, so the figure keeps its height. */
export function DrawingNotes({ notes }: { notes: string[] }) {
  const { i18n } = useLingui()
  return (
    <AppPopover width={popoverWidth.notes} position="bottom-start" withArrow trapFocus>
      <Popover.Target>
        <Button
          variant="subtle"
          size={controlSize.row.button}
          leftSection={<Info aria-hidden="true" />}
          className="screen-only"
        >
          {i18n._({ id: 'recordActions.drawingNotes', message: 'Drawing notes' })}
        </Button>
      </Popover.Target>
      <Popover.Dropdown className="drawing-notes">
        {notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </Popover.Dropdown>
    </AppPopover>
  )
}
