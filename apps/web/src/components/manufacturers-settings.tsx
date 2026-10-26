'use client'

import { Button, Group, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../lib/error-text.ts'
import {
  type ManufacturerUse,
  manufacturersChanged,
  manufacturerUses,
} from '../lib/manufacturers.ts'
import { controlSize } from '../lib/theme.ts'
import { deleteRecord, putRecords, storedRecords } from '../lib/user-store.ts'
import { offerUndo } from './confirm.tsx'
import { ErrorNote, Loading } from './states.tsx'

/**
 * The Manufacturers section of Settings, General: the manufacturers typed in this browser, each
 * with the number of records that name it. One that nothing names is deleted at once, with Undo.
 */
export function ManufacturersForm() {
  const [rows, setRows] = useState<ManufacturerUse[]>()
  const [failure, setFailure] = useState('')
  const read = useCallback(
    () =>
      storedRecords().then(
        ({ records, invalid }) => {
          setFailure('')
          setRows(manufacturerUses(records, invalid))
        },
        (e) => {
          setRows([])
          setFailure(`The browser's records could not be read: ${errorText(e)}`)
        },
      ),
    [],
  )
  useEffect(() => {
    void read()
  }, [read])

  async function remove({ record }: ManufacturerUse) {
    try {
      // counted again: a record saved since the list was read may name it now
      const { records, invalid } = await storedRecords()
      if (manufacturerUses(records, invalid).find((m) => m.record.id === record.id)?.uses !== 0) {
        await read()
        setFailure(`${record.name} was not deleted: a record names it now.`)
        return
      }
      await deleteRecord(record.id)
    } catch (e) {
      setFailure(`${record.name} was not deleted: ${errorText(e)}`)
      return
    }
    await read()
    window.dispatchEvent(new Event(manufacturersChanged))
    offerUndo(`Deleted ${record.name} from this browser.`, () =>
      putRecords([record])
        .then(read)
        .then(
          () => void window.dispatchEvent(new Event(manufacturersChanged)),
          (e) => setFailure(`Undo of ${record.name} failed: ${errorText(e)}`),
        ),
    )
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        A name typed in a manufacturer field that the catalogue does not have is kept here. One that
        no record uses can be deleted.
      </Text>
      {failure && <ErrorNote>{failure}</ErrorNote>}
      {rows === undefined ? (
        <Loading what="manufacturers" rows={2} />
      ) : rows.length === 0 ? (
        <Text size="sm">No manufacturers of your own in this browser.</Text>
      ) : (
        <Stack component="ul" gap={6} m={0} p={0} style={{ listStyle: 'none' }}>
          {rows.map((row) => (
            <Group component="li" key={row.record.id} justify="space-between" wrap="nowrap">
              <span>
                <Text span>{row.record.name}</Text>
                <Text span size="sm" c="dimmed">
                  {' '}
                  {row.uses === 0 ? 'unused' : `used by ${row.uses}`}
                </Text>
              </span>
              {row.uses === 0 && (
                <Button
                  size={controlSize.row.button}
                  variant="default"
                  aria-label={`Delete ${row.record.name}`}
                  onClick={() => void remove(row)}
                >
                  Delete
                </Button>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
