'use client'

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
  ArrowsLeftRight,
  Check,
  Copy,
  Flask,
  Info,
  LinkSimple,
  PencilSimple,
  Printer,
  Target,
} from '@phosphor-icons/react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import { AppPopover, popoverWidth } from './app-popover.tsx'
import { UnitsIconButton } from './units-settings.tsx'

/**
 * A link among the page bar's buttons with its icon, drawn as a default Mantine button, or filled
 * as the page's one primary action.
 */
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

/**
 * Every record page's actions, one component so they cannot drift: Use in
 * workbench or Open in shot groups (filled, the primary action), Open in designer, Compare, each where the record has
 * one, then Units, Copy link and Print as icon buttons with their names on hover and focus. The
 * bullet comparison shows the icon buttons alone.
 */
export function RecordActions({
  compare,
  workbench,
  groups,
  design,
}: {
  compare?: string | undefined
  workbench?: string | undefined
  groups?: string | undefined
  design?: string | undefined
}) {
  const { t } = useTranslation()
  const clipboard = useClipboard({ timeout: 2000 })
  return (
    <>
      {workbench && (
        <LinkButton href={workbench} icon={<Flask aria-hidden="true" />} primary>
          {t('Use in workbench')}
        </LinkButton>
      )}
      {groups && (
        <LinkButton href={groups} icon={<Target aria-hidden="true" />} primary>
          {t('Open in shot groups')}
        </LinkButton>
      )}
      {design && (
        <LinkButton href={design} icon={<PencilSimple aria-hidden="true" />}>
          {t('Open in designer')}
        </LinkButton>
      )}
      {compare && (
        <LinkButton href={compare} icon={<ArrowsLeftRight aria-hidden="true" />}>
          {t('Compare')}
        </LinkButton>
      )}
      <UnitsIconButton />
      {/* the name stays, so a copy moves nothing */}
      <Tooltip
        label={clipboard.copied ? t('Link copied') : t('Copy link')}
        {...(clipboard.copied && { opened: true })}
      >
        <ActionIcon
          variant="default"
          aria-label={t('Copy link')}
          onClick={() => clipboard.copy(window.location.href)}
        >
          <LinkSimple aria-hidden="true" />
        </ActionIcon>
      </Tooltip>
      <PrintButton />
    </>
  )
}

/**
 * Print in a page bar: an icon button named Print, the name (or `hint`, what the print holds) on
 * hover and focus, as the other icon actions of the bars.
 */
export function PrintButton({
  onClick = () => window.print(),
  disabled,
  hint,
}: {
  onClick?: () => void
  disabled?: boolean
  hint?: string
}) {
  const { t } = useTranslation()
  return (
    <Tooltip label={hint ?? t('Print')} multiline={!!hint} maw={hint ? 320 : undefined}>
      <ActionIcon
        variant="default"
        aria-label={t('Print')}
        {...(disabled !== undefined && { disabled })}
        onClick={onClick}
      >
        <Printer aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}

/** Hex digits of a SHA-256 shown on screen; the rest is in the tooltip and in print. */
const shortDigits = 12

/** A source file's hash, short, as a button that copies it; the full value on hover or focus. */
export function CopyHash({ hash }: { hash: string }) {
  const { t } = useTranslation()
  return (
    <span className="hash">
      SHA-256{' '}
      <CopyButton value={hash} timeout={2000}>
        {({ copied, copy }) => (
          <Tooltip
            label={copied ? t('Copied') : hash}
            events={tipEvents}
            multiline
            classNames={{ tooltip: 'hash-tooltip' }}
          >
            <UnstyledButton
              className="hash-copy"
              aria-label={
                copied
                  ? t('Hash copied')
                  : t('Copy hash {hash}', { hash: hash.slice(0, shortDigits) })
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
  const { t } = useTranslation()
  return (
    <AppPopover width={popoverWidth.notes} position="bottom-start" withArrow trapFocus>
      <Popover.Target>
        <Button
          variant="subtle"
          size={controlSize.row.button}
          leftSection={<Info aria-hidden="true" />}
          className="screen-only"
        >
          {t('Drawing notes')}
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
