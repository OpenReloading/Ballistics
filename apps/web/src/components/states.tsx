'use client'

import { Alert, Button, EmptyState, Group, Skeleton, Stack, Text } from '@mantine/core'
import { FunnelX, WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { controlSize } from '../lib/theme.ts'
import { PageBar } from './page-bar.tsx'

/** The one empty state of the app: nothing to show yet, and the action that adds it. */
export function EmptyNote({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      size="sm"
      align="left"
      my="xs"
      styles={{ description: { maxWidth: '60ch' } }}
    >
      {action && <EmptyState.Actions>{action}</EmptyState.Actions>}
    </EmptyState>
  )
}

/**
 * The one loading state: the text for screen readers and a skeleton of the rows to come. `inline`
 * is a bare line without skeleton and status role, for a place that must not change height.
 */
export function Loading({
  what,
  rows = 3,
  inline = false,
}: {
  what: string
  rows?: number
  inline?: boolean
}) {
  if (inline) return <p>{`Loading ${what}`}</p>
  return (
    <div role="status">
      <Text size="sm" c="dimmed">
        Loading {what}…
      </Text>
      <Stack gap={6} mt={6} aria-hidden="true">
        {Array.from({ length: rows }, (_, k) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders without identity
          <Skeleton key={k} height={28} />
        ))}
      </Stack>
    </div>
  )
}

/**
 * The one inline alert: what failed, and Retry with `onRetry`. `color` orange marks a warning
 * that is no failure.
 */
export function ErrorNote({
  title,
  children,
  onRetry,
  color = 'red',
}: {
  title?: string
  children?: ReactNode
  onRetry?: () => void
  color?: 'red' | 'orange'
}) {
  return (
    <Alert
      color={color}
      variant="light"
      title={title}
      icon={<WarningCircle size={20} aria-hidden="true" />}
      my="xs"
    >
      {children}
      {onRetry && (
        <Button
          display="block"
          size={controlSize.row.button}
          variant="default"
          mt={children ? 'xs' : 0}
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </Alert>
  )
}

/** The data of a page could not be read from the API; Retry asks again. */
export function DataError({ what, retry }: { what: string; retry: () => void }) {
  return (
    <ErrorNote title={`${what} data is unavailable right now.`} onRetry={retry}>
      The server did not answer.
    </ErrorNote>
  )
}

/** A list page's error state: its page bar over `DataError`. */
export function ListError({
  title,
  what,
  retry,
}: {
  title: string
  what: string
  retry: () => void
}) {
  return (
    <>
      <PageBar title={title} />
      <DataError what={what} retry={retry} />
    </>
  )
}

/** `DataError` in a server page: Retry renders the page's server data again. */
export function ServerDataError({ what }: { what: string }) {
  const router = useRouter()
  return <DataError what={what} retry={() => router.refresh()} />
}

/** Row widths of the list skeleton, in percent of the name column: uneven, so it reads as text. */
const skeletonWidths = [62, 48, 70, 55, 66, 42, 58, 74, 50, 64, 46, 68]

/**
 * What a list shows while its data loads, under the page bar: a filter row and the table's
 * frame, its head and rows where the records will be, so nothing moves when they arrive.
 */
export function ListLoading({ what }: { what: string }) {
  return (
    <div className="directory" role="status">
      <span className="visually-hidden">Loading {what}…</span>
      {/* the metrics of the real filter row (DirectoryFilters), so the frame stays where it is */}
      <Group className="directory-filters" gap="xs" py="xs" aria-hidden="true">
        <Skeleton height={30} className="directory-search" />
        <Skeleton height={30} />
        <Skeleton height={30} />
      </Group>
      <div className="directory-scroll page-panel page-panel-flush" aria-hidden="true">
        <div className="list-skeleton-head" />
        {Array.from({ length: 32 }, (_, k) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders without identity
          <div key={k} className="list-skeleton-row">
            <Skeleton height={12} width={`${skeletonWidths[k % skeletonWidths.length]}%`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * What a filtered list shows when nothing matches. `filters` names the filters set; Clear filters
 * with `onClear`, for a list without its own in the filter row.
 */
export function EmptyList({
  noun,
  filters,
  onClear,
}: {
  noun: string
  filters?: string
  onClear?: () => void
}) {
  return (
    <EmptyNote
      icon={<FunnelX size={24} aria-hidden="true" />}
      title={`No ${noun} match these filters.`}
      description={filters}
      action={
        onClear && (
          <Button variant="default" size={controlSize.row.button} onClick={onClear}>
            Clear filters
          </Button>
        )
      }
    />
  )
}
