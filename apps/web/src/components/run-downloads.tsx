'use client'

import { Button, Group } from '@mantine/core'
import { DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from '../i18n/language.ts'
import type { InteriorResponse } from '../lib/api-types.ts'
import { download } from '../lib/download.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'

const saveCsv = (text: string, name: string) =>
  download(new Blob([text], { type: 'text/csv;charset=utf-8' }), name)

/**
 * The downloads of the shown run: its curves, one row per time step, and its scalar results, as
 * CSV files with the units in the header. The files hold numbers only, no notice.
 */
export function RunDownloads({
  body,
  charge,
  mass,
  system,
}: {
  body: InteriorResponse
  /** The run's charge and bullet mass, kg. */
  charge: number
  mass: number
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const icon = <DownloadSimple size={16} aria-hidden="true" />
  return (
    <Group gap="xs" className="run-downloads">
      <Button
        size={controlSize.row.button}
        variant="default"
        leftSection={icon}
        onClick={async () => {
          // the builders load on the first download: the page carries none of them
          const { curvesCsv } = await import('../lib/run-csv.ts')
          saveCsv(curvesCsv(body.result.points, mass, system, t), 'run-curves.csv')
        }}
      >
        {t('Curves (CSV)')}
      </Button>
      <Button
        size={controlSize.row.button}
        variant="default"
        leftSection={icon}
        onClick={async () => {
          const { resultsCsv } = await import('../lib/run-csv.ts')
          saveCsv(resultsCsv(body, charge, system, t), 'run-results.csv')
        }}
      >
        {t('Results (CSV)')}
      </Button>
    </Group>
  )
}
