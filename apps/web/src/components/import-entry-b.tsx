'use client'

import { Button, Group, Stack } from '@mantine/core'
import {
  Commit,
  FileReport,
  FileSource,
  FileVerdict,
  KindControl,
  MappingBlock,
  Panel,
  Picker,
  PreviewTable,
  useImport,
} from './import-entry-core.tsx'

/** Layout B: one page of file cards, mapping inline, one report at the foot. */
export default function ImportEntryB() {
  const s = useImport()
  return (
    <Stack gap="md" maw="60rem">
      <Picker s={s} />
      {s.files.map((f) => (
        <Panel key={f.id}>
          <Stack gap="xs">
            <Group justify="space-between" wrap="wrap">
              <FileVerdict e={f} />
              <Button size="compact-xs" variant="subtle" onClick={() => s.remove(f.id)}>
                Remove {f.name}
              </Button>
            </Group>
            <KindControl e={f} s={s} />
            <MappingBlock e={f} s={s} />
            <PreviewTable e={f} />
            <FileReport e={f} />
            {f.card?.type !== 'refused' && <FileSource e={f} s={s} />}
          </Stack>
        </Panel>
      ))}
      {s.files.length > 0 && <Commit s={s} />}
    </Stack>
  )
}
