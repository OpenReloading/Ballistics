'use client'

import { NativeSelect } from '@mantine/core'
import type { VelocityUnit } from '@open-reloading/importers'
import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formats, templateCsv, templateJson } from '../lib/chrono.ts'
import { ChronoDropZone } from './chrono-drop-zone.tsx'

const jsonTemplateHref = `data:application/json;charset=utf-8,${encodeURIComponent(templateJson)}`
const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`

/** The JSON and CSV template downloads; `json` is the first link's text. */
export function TemplateLinks({ json, between }: { json?: string; between?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <>
      <a href={jsonTemplateHref} download="openreloading-session-template.json">
        {json ?? t('JSON template')}
      </a>
      {between}
      <a href={templateHref} download="openreloading-session-template.csv">
        {t('CSV template')}
      </a>
    </>
  )
}

/**
 * The chronograph file controls of the session summary and the workbench's Measurements tab: a drop
 * area holding the file input, the velocity unit for files that name none, the formats read and the
 * JSON and CSV templates. The callers read the files.
 */
export function ChronoFileInput({
  id,
  unitId,
  label,
  multiple = false,
  unit,
  onUnit,
  onFiles,
}: {
  id: string
  unitId: string
  label: string
  multiple?: boolean
  unit: VelocityUnit | ''
  onUnit: (unit: VelocityUnit | '') => void
  onFiles: (files: File[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="file-controls chrono-import">
      <ChronoDropZone id={id} label={label} variant="box" multiple={multiple} onFiles={onFiles} />
      <NativeSelect
        id={unitId}
        label={t('Velocity unit when the file names none')}
        value={unit}
        onChange={(e) => onUnit(e.currentTarget.value as VelocityUnit | '')}
        data={[
          { value: '', label: t('not set') },
          { value: 'ft/s', label: 'ft/s' },
          { value: 'm/s', label: 'm/s' },
        ]}
      />
      <p className="note chrono-formats">
        {t('Reads {formats}.', { formats })}{' '}
        <TemplateLinks json={t('Download JSON template')} between=" · " />
      </p>
    </div>
  )
}
