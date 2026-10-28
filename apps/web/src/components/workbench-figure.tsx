'use client'

import { ActionIcon, SegmentedControl, Tooltip } from '@mantine/core'
import { ArrowsOut } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { type ComponentProps, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { FigureView } from '../lib/figure-views.ts'
import { controlSize } from '../lib/theme.ts'
import type { SeatingPreview as Preview } from './seating-preview.tsx'
import { Loading } from './states.tsx'
import { useLoad } from './workbench-context.ts'

const SeatingPreview = dynamic(
  () => import('./seating-preview.tsx').then((m) => m.SeatingPreview),
  { ssr: false, loading: () => <Loading what="the preview" inline /> },
)

/** The cartridge with the bullet seated live; edits redraw it, no simulation runs. */
export function CartridgeFigure({
  view: figureView,
  onView,
  previewKey,
  ...preview
}: {
  view: FigureView
  onView: (view: FigureView) => void
  /** The preview's key: a new cartridge or preset seats afresh. */
  previewKey: string
} & Omit<ComponentProps<typeof Preview>, 'view' | 'fullView'>) {
  const { t } = useTranslation()
  const [full, setFull] = useState(false)
  return (
    <section aria-label={t('Cartridge figure')} className="cartridge-figure">
      {/* the cartridge with the seated bullet, the chamber alone, or both: one panel
          whose value follows the tab, so one preview keeps its seating across the tabs */}
      <div className="figure-view">
        <div className="figure-head">
          <SegmentedControl
            fullWidth
            size={controlSize.row.toggle}
            withItemsBorders={false}
            aria-label={t('Cartridge figure view')}
            value={figureView}
            onChange={(v) => onView(v as FigureView)}
            data={[
              { value: 'cartridge', label: t('Cartridge') },
              { value: 'chamber', label: t('Chamber') },
              { value: 'combined', label: t('Combined') },
            ]}
          />
          {/* the card is too small for the dimension texts: the full view draws it at the window's height */}
          <Tooltip label={t('Full view')}>
            <ActionIcon
              variant="subtle"
              size={controlSize.row.icon}
              aria-label={t('Full view')}
              onClick={() => setFull(true)}
            >
              <ArrowsOut size={16} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        </div>
        <div className="figure-panel">
          <SeatingPreview
            key={previewKey}
            view={figureView}
            fullView={{ opened: full, onClose: () => setFull(false) }}
            {...preview}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * The result tab Cartridge of a low desktop window: the place the cartridge figure moves to from
 * the inputs' second column. The one figure of the inputs is drawn here, so its seating stays.
 */
export function FigureTab() {
  const { setFigureTab } = useLoad()
  return <div ref={setFigureTab} className="figure-tab" />
}
