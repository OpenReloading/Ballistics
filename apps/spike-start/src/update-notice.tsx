import { useLingui } from '@lingui/react'
import { Affix, Button, Paper, Text } from '@mantine/core'
import { takeOver } from './sw-register.ts'

/** A new version waits until the user confirms. */
export function UpdateNotice({ waiting }: { waiting: ServiceWorker }) {
  const { i18n } = useLingui()
  return (
    <Affix position={{ bottom: 16, right: 16 }}>
      <Paper withBorder shadow="md" p="sm" className="update-notice" role="status">
        <Text size="sm" fw={600}>
          {i18n._({ id: 'update.title', message: 'New version' })}
        </Text>
        <Button size="xs" onClick={() => takeOver(waiting)}>
          {i18n._({ id: 'update.reload', message: 'Reload' })}
        </Button>
      </Paper>
    </Affix>
  )
}
