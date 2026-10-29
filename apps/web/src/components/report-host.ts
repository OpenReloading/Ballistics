import type { TargetSheet } from '@open-reloading/schema'
import { useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { fetchFederationData } from '../lib/face-records.ts'
import { sheetSettings, shotPositions } from '../lib/report-issue.ts'

/** Page data a report may carry, a checkbox in the Report issue dialog, unticked at first. */
export type ReportOption = {
  label: string
  /** The heading of its block in the issue body. */
  heading: string
  /** The block's Markdown; undefined when the page has none to give. */
  text: () => string | undefined | Promise<string | undefined>
  /** The label of the option that must be ticked first. */
  needs?: string
}

/** The options of the page shown, set while it is mounted. */
export const reportHost: { options?: (() => ReportOption[]) | undefined } = {}

/** Offers `options` to the Report issue dialog while the calling page is mounted; none when undefined. */
export function useReportOptions(options: ReportOption[] | undefined) {
  const latest = useRef(options)
  latest.current = options
  const offered = options !== undefined
  useEffect(() => {
    if (!offered) return
    const get = () => latest.current ?? []
    reportHost.options = get
    return () => {
      if (reportHost.options === get) reportHost.options = undefined
    }
  }, [offered])
}

/** The shot groups page's boxes: the sheet's settings, then its shot positions; none without a sheet. */
export function useSheetReport(sheet: Pick<TargetSheet, 'groups'> | undefined) {
  const { t } = useTranslation()
  const settingsLabel = t('Include the sheet settings (no photo)')
  useReportOptions(
    sheet && [
      {
        label: settingsLabel,
        heading: 'Sheet settings',
        text: async () => sheetSettings(sheet, await fetchFederationData().catch(() => undefined)),
      },
      {
        label: t('Include shot positions'),
        heading: 'Shot positions',
        text: () => shotPositions(sheet),
        needs: settingsLabel,
      },
    ],
  )
}
