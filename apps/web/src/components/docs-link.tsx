import { useLingui } from '@lingui/react'
import { ActionIcon, NavLink, Tooltip } from '@mantine/core'
import { Library } from 'lucide-react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/docs-link.json' with { type: 'json' }

loadEnglish(englishMessages)

const label = /*i18n*/ { id: 'shell.documentation', message: 'Documentation' }

/** An icon named by its tooltip in the sidebar's foot, a labeled row in the phone drawer; nothing without a URL. */
export function DocsLink({
  url,
  drawer,
}: {
  url?: string | undefined
  drawer?: boolean | undefined
}) {
  const { i18n } = useLingui()
  if (!url) return null
  if (drawer)
    return (
      <NavLink
        component="a"
        href={url}
        label={i18n._(label)}
        leftSection={<Library size={20} aria-hidden="true" />}
      />
    )
  return (
    <Tooltip label={i18n._(label)} position="right" transitionProps={{ duration: 0 }}>
      <ActionIcon
        component="a"
        href={url}
        size="xl"
        variant="subtle"
        color="gray"
        aria-label={i18n._(label)}
      >
        <Library size={24} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
