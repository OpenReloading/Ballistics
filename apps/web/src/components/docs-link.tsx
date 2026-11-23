import { ActionIcon, NavLink, Tooltip } from '@mantine/core'
import { Library } from 'lucide-react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

const label = msg('Documentation')

/** An icon named by its tooltip in the sidebar's foot, a labeled row in the phone drawer; nothing without a URL. */
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
        leftSection={<Library size={20} aria-hidden="true" />}
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
        <Library size={24} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
