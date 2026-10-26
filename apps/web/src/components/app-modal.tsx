'use client'

import { Modal, type ModalRootProps } from '@mantine/core'
import type { ComponentProps, ReactNode } from 'react'

/**
 * A modal dialog assembled from Mantine's parts, with a `div` as header: a second `<header>` beside
 * the site header would be another banner landmark. `closeButton` is `false` for none or the props of
 * the close button (Mantine's default one when omitted); `bodyProps` go to the body, `footer` stands below it, outside the scrolling body.
 * Every other prop goes to `Modal.Root`.
 */
export function AppModal({
  title,
  closeButton = {},
  bodyProps,
  footer,
  children,
  ...root
}: Omit<ModalRootProps, 'title'> & {
  title: ReactNode
  closeButton?: false | ComponentProps<typeof Modal.CloseButton> | undefined
  bodyProps?: (ComponentProps<typeof Modal.Body> & { 'data-autofocus'?: boolean }) | undefined
  footer?: ReactNode | undefined
}) {
  return (
    <Modal.Root {...root}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header component="div">
          <Modal.Title>{title}</Modal.Title>
          {closeButton && <Modal.CloseButton {...closeButton} />}
        </Modal.Header>
        <Modal.Body {...bodyProps}>{children}</Modal.Body>
        {footer}
      </Modal.Content>
    </Modal.Root>
  )
}
