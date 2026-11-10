import { ActionIcon, NavLink } from '@mantine/core'
import { GithubLogo } from '@phosphor-icons/react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'

const label = msg('Source code on GitHub')

/** An icon next to the theme switch from 75em, a labeled row in the phone drawer; nothing without a URL. */
export function RepositoryLink({
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
        leftSection={<GithubLogo size={20} aria-hidden="true" />}
      />
    )
  return (
    <ActionIcon
      component="a"
      href={url}
      variant="default"
      visibleFrom="lg"
      aria-label={t(label)}
      className="repository-link"
    >
      <GithubLogo size={20} aria-hidden="true" />
    </ActionIcon>
  )
}
