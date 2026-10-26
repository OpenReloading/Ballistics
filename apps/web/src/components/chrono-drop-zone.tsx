'use client'

import { Tooltip } from '@mantine/core'
import { type DragEvent, useState } from 'react'
import { tipEvents } from '../lib/theme.ts'

/**
 * The chronograph file drop area, a label around a visually hidden file input. `box` is the
 * Measurements tab's tall area (several files, the hint says the file stays in the browser); `bar`
 * is the session page's one-line area (one file, `help` in a tooltip and for screen readers; with
 * `file`, its name and Replace in place of the hint). The callers read the files.
 */
export function ChronoDropZone({
  id,
  label,
  variant,
  multiple = false,
  help,
  file,
  onFiles,
}: {
  id: string
  label: string
  variant: 'box' | 'bar'
  multiple?: boolean
  help?: string | undefined
  /** The name of the file read (bar). */
  file?: string | undefined
  onFiles: (files: File[]) => void
}) {
  const [over, setOver] = useState(false)
  const bar = variant === 'bar'
  const described = bar ? `${id}-help` : `${id}-hint`
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const files = [...e.dataTransfer.files]
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }
  const zone = (
    <label
      htmlFor={id}
      className="drop-zone"
      data-over={over || undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <span id={`${id}-label`} className="drop-zone-label">
        {label}
      </span>
      {bar ? (
        <>
          {file ? (
            <>
              <span className="drop-zone-file">{file}</span>
              <span className="drop-zone-action">Replace</span>
            </>
          ) : (
            <span className="drop-zone-hint">Drop a file here or click to choose</span>
          )}
          <span id={described} className="visually-hidden">
            {help}
          </span>
        </>
      ) : (
        <span id={described} className="drop-zone-hint">
          Drop {multiple ? 'files' : 'a file'} here or click to choose. Read in this browser, not
          uploaded.
        </span>
      )}
      <input
        id={id}
        type="file"
        className="visually-hidden"
        aria-labelledby={`${id}-label`}
        aria-describedby={described}
        multiple={multiple}
        accept=".json,.csv,.txt,.xlsx,.xls,application/json,text/csv,text/plain"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          // cleared, so choosing the same file again reads it again
          e.target.value = ''
          onFiles(files)
        }}
      />
    </label>
  )
  return bar ? (
    <Tooltip label={help} events={tipEvents} multiline maw={320}>
      {zone}
    </Tooltip>
  ) : (
    zone
  )
}
