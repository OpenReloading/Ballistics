import { ActionIcon, NavLink, Tooltip } from '@mantine/core'
import { Books } from '@phosphor-icons/react'

const label = 'Documentation'

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
  if (!url) return null
  if (drawer)
    return (
      <NavLink
        component="a"
        href={url}
        label={label}
        leftSection={<Books size={20} aria-hidden="true" />}
      />
    )
  return (
    <Tooltip label={label} position="right" transitionProps={{ duration: 0 }}>
      <ActionIcon
        component="a"
        href={url}
        size="xl"
        variant="subtle"
        color="gray"
        aria-label={label}
      >
        <Books size={24} aria-hidden="true" />
      </ActionIcon>
    </Tooltip>
  )
}
