'use client'

import { Popover, type PopoverProps } from '@mantine/core'

/** `min(<size>, calc(100vw - 2rem))`: a width that leaves 1rem at each side of a narrow window. */
const fitViewport = (size: string) => `min(${size}, calc(100vw - 2rem))`

/** The widths of the popovers, each by what it holds; the others take the width of their content. */
export const popoverWidth = {
  filters: '21rem',
  notes: 320,
  fields: 380,
  help: fitViewport('24rem'),
  list: fitViewport('36rem'),
  table: fitViewport('760px'),
}

/**
 * A `Popover` that returns the focus to its trigger and has the medium shadow. Mantine's own users
 * of `Popover` (Select, Menu) keep their defaults, so these are not theme defaults.
 */
export function AppPopover(props: PopoverProps) {
  return <Popover returnFocus shadow="md" {...props} />
}
