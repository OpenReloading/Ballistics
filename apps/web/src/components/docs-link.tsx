import { ActionIcon, NavLink, Tooltip } from '@mantine/core'
import { Books } from '@phosphor-icons/react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

const label = msg('Documentation')

/**
 * The link to the docs site: an icon in the sidebar's foot (tooltip as its name), a labelled row in
 * the phone drawer. Renders nothing without a URL.
 */
export function DocsLink({
  url,
  drawer,
}: {
  url?: string | undefined
  drawer?: boolean | undefined
}) {
  const { t } = useTranslation()
  if (!url) return null
  if (drawer)
    return (
      <NavLink
        component="a"
        href={url}
        label={t(label)}
        leftSection={<Books size={20} aria-hidden="true" />}
      />
    )
  return (
    <Tooltip label={t(label)} position="right" transitionProps={{ duration: 0 }}>
      <ActionIcon
        component="a"
        href={url}
        size="xl"
        variant="subtle"
        color="gray"
        aria-label={t(label)}
      >
        <Books size={24} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
