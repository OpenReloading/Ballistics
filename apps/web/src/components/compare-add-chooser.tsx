'use client'

import type { BulletRow } from '../lib/bullet-rows.ts'
import type { UnitSystem } from '../lib/units.ts'
import { bulletKind } from './bullet-search-dialog.tsx'
import { RecordChooser } from './record-chooser.tsx'

/** The bullet search of the comparison's Add bullet, its own chunk: loaded on the first click. */
export function CompareAddChooser({
  opened,
  onClose,
  system,
  onChoose,
}: {
  opened: boolean
  onClose: () => void
  system: UnitSystem
  onChoose: (row: BulletRow) => void
}) {
  return (
    <RecordChooser
      kind={bulletKind}
      opened={opened}
      onClose={onClose}
      text=""
      designs={[]}
      system={system}
      onChoose={onChoose}
    />
  )
}
