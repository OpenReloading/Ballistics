'use client'

import { NativeSelect } from '@mantine/core'
import type { VelocityUnit } from '@open-reloading/importers'
import type { ReactNode } from 'react'
import { formatNames, templateCsv, templateJson } from '../lib/chrono.ts'
import { ChronoDropZone } from './chrono-drop-zone.tsx'

const jsonTemplateHref = `data:application/json;charset=utf-8,${encodeURIComponent(templateJson)}`
const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`

/** Formats read in the browser: a delimited file needs a column mapping, which the browser does not take. */
export const formats = Object.entries(formatNames)
  .filter(([k]) => k !== 'delimited')
  .map(([, name]) => name)
  .join(', ')

/** The JSON and CSV template downloads; `json` is the first link's text. */
export function TemplateLinks({
  json = 'JSON template',
  between,
}: {
  json?: string | undefined
  between?: ReactNode | undefined
}) {
  return (
    <>
      <a href={jsonTemplateHref} download="openreloading-session-template.json">
        {json}
      </a>
      {between}
      <a href={templateHref} download="openreloading-session-template.csv">
        CSV template
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
  multiple?: boolean | undefined
  unit: VelocityUnit | ''
  onUnit: (unit: VelocityUnit | '') => void
  onFiles: (files: File[]) => void
}) {
  return (
    <div className="file-controls chrono-import">
      <ChronoDropZone id={id} label={label} variant="box" multiple={multiple} onFiles={onFiles} />
      <NativeSelect
        id={unitId}
        label="Velocity unit when the file names none"
        value={unit}
        onChange={(e) => onUnit(e.currentTarget.value as VelocityUnit | '')}
        data={[
          { value: '', label: 'not set' },
          { value: 'ft/s', label: 'ft/s' },
          { value: 'm/s', label: 'm/s' },
        ]}
      />
      <p className="note chrono-formats">
        Reads {formats}. <TemplateLinks json="Download JSON template" between=" · " />
      </p>
    </div>
  )
}
