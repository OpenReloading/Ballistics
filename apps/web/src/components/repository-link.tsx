import { useLingui } from '@lingui/react'
import { ActionIcon, NavLink } from '@mantine/core'
import { CodeXml } from 'lucide-react'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/repository-link.json' with { type: 'json' }

loadEnglish(englishMessages)

const label = /*i18n*/ { id: 'repositoryLink.label', message: 'Source code on GitHub' }

/** An icon next to the theme switch from 75em, a labeled row in the phone drawer; nothing without a URL. */
export function RepositoryLink({
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
        leftSection={<CodeXml size={20} aria-hidden="true" />}
      />
    )
  return (
    <ActionIcon
      component="a"
      href={url}
      variant="default"
      visibleFrom="lg"
      aria-label={i18n._(label)}
      className="repository-link"
    >
      <CodeXml size={20} aria-hidden="true" />
    </ActionIcon>
  )
}
