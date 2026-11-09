'use client'

import { Modal, type ModalRootProps } from '@mantine/core'
import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'

/** The header is a `div`, as a second `<header>` beside the site header would be another banner landmark; `closeButton` false for none, `footer` outside the scrolling body. */
export function AppModal({
  title,
  closeButton = {},
  bodyProps,
  footer,
  children,
  ...root
}: Omit<ModalRootProps, 'title'> & {
  title: ReactNode
  closeButton?: false | ComponentProps<typeof Modal.CloseButton>
  bodyProps?: ComponentProps<typeof Modal.Body> & { 'data-autofocus'?: boolean }
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Modal.Root {...root}>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header component="div">
          {/* the marker of the accessibility sweep's reviewed list */}
          <Modal.Title data-testid="dialog-title">{title}</Modal.Title>
          {closeButton && <Modal.CloseButton aria-label={t('Close')} {...closeButton} />}
        </Modal.Header>
        <Modal.Body {...bodyProps}>{children}</Modal.Body>
        {footer}
      </Modal.Content>
    </Modal.Root>
  )
}
