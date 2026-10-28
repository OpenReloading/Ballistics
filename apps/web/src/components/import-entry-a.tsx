'use client'

import { Button, Group, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { AppModal } from './app-modal.tsx'
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

const steps = ['Files', 'Check', 'Map', 'Report'] as const

/** Layout A: one modal, four steps. */
export default function ImportEntryA() {
  const s = useImport()
  const [opened, setOpened] = useState(false)
  const [step, setStep] = useState(0)
  const tables = s.files.filter((f) => f.card?.type === 'table' && f.kind)
  return (
    <>
      <Button
        onClick={() => {
          setStep(0)
          setOpened(true)
        }}
      >
        Import…
      </Button>
      {s.committed && <Text size="sm">{s.committed.stored} records in this browser.</Text>}
      <AppModal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Import"
        size="lg"
        fullScreen={false}
        footer={
          <Group justify="space-between" p="md" wrap="wrap">
            <Button variant="default" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            {step < 3 && (
              <Button disabled={s.files.length === 0 || s.busy} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            )}
          </Group>
        }
      >
        <Stack gap="sm">
          <Group gap="md" aria-label="Steps" wrap="wrap">
            {steps.map((n, i) => (
              <Text
                key={n}
                size="sm"
                fw={i === step ? 700 : 400}
                {...(i !== step && { c: 'dimmed' })}
                aria-current={i === step ? 'step' : undefined}
              >
                {i + 1} {n}
              </Text>
            ))}
          </Group>
          {step === 0 && (
            <>
              <Picker s={s} />
              {s.files.map((f) => (
                <Text key={f.id} size="sm">
                  {f.name}
                </Text>
              ))}
            </>
          )}
          {step === 1 &&
            s.files.map((f) => (
              <Panel key={f.id}>
                <Stack gap="xs">
                  <FileVerdict e={f} />
                  <KindControl e={f} s={s} />
                  {f.card?.type === 'refused' && (
                    <Text size="sm" c="red">
                      {f.card.reason}
                    </Text>
                  )}
                  {f.card?.type === 'load' &&
                    f.card.notes?.map((n) => (
                      <Text key={n} size="sm" c="dimmed">
                        {n}
                      </Text>
                    ))}
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => s.remove(f.id)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Remove {f.name}
                  </Button>
                </Stack>
              </Panel>
            ))}
          {step === 2 &&
            (tables.length === 0 ? (
              <Text size="sm">No table to map.</Text>
            ) : (
              tables.map((f) => (
                <Panel key={f.id}>
                  <Stack gap="xs">
                    <FileVerdict e={f} />
                    <MappingBlock e={f} s={s} />
                    <PreviewTable e={f} />
                  </Stack>
                </Panel>
              ))
            ))}
          {step === 3 && (
            <>
              {s.files.map((f) => (
                <Panel key={f.id}>
                  <Stack gap="xs">
                    <FileVerdict e={f} />
                    <FileReport e={f} />
                    {f.card?.type !== 'refused' && <FileSource e={f} s={s} />}
                  </Stack>
                </Panel>
              ))}
              <Commit s={s} />
            </>
          )}
        </Stack>
      </AppModal>
    </>
  )
}
