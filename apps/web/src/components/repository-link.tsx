import { ActionIcon, NavLink } from '@mantine/core'
import { GithubLogo } from '@phosphor-icons/react'

const label = 'Source code on GitHub'

/**
 * The link to the source repository: an icon next to the theme switch in the top bar from
 * 75em, a labelled row in the phone drawer. Renders nothing without a URL.
 */
export function RepositoryLink({
  url,
  drawer,
}: {
  url?: string | undefined
  drawer?: boolean | undefined
}) {
  if (!url) return null
  if (drawer)
    return (
      <NavLink
        component="a"
        href={url}
        label={label}
        leftSection={<GithubLogo size={20} aria-hidden="true" />}
      />
    )
  return (
    <ActionIcon
      component="a"
      href={url}
      variant="default"
      visibleFrom="lg"
      aria-label={label}
      className="repository-link"
    >
      <GithubLogo size={20} aria-hidden="true" />
    </ActionIcon>
  )
}
