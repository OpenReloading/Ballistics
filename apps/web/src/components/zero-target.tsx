'use client'

import { Button, Menu } from '@mantine/core'
import { parseRef, type ShotGroup, type TargetSheet, userRecord } from '@open-reloading/schema'
import { useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { download } from '../lib/download.ts'
import { storedRecord } from '../lib/user-store.ts'
import {
  formatVersion,
  gridPitch,
  markSpacing,
  sessionRefOf,
  targetId,
  type ZeroTargetSource,
  zeroTargetSvg,
  zeroTargetValues,
} from '../lib/zero-target.ts'
import { printAlone, usePortalBody } from './print.ts'

/** The id of a `user:` reference. */
const own = (ref: string | undefined) => {
  const r = ref === undefined ? undefined : parseRef(ref)
  return r?.scope === 'user' ? r.id : undefined
}

/** The record `id` of this browser when it is valid, else undefined. */
async function stored(id: string | undefined) {
  if (id === undefined) return
  const r = userRecord.safeParse(await storedRecord(id).catch(() => undefined))
  return r.success ? r.data : undefined
}

/**
 * What the sheet's fields are filled from: the load's firearm and cartridge, the group and the day
 * of the session its shots name. A record not found leaves its field blank.
 */
async function sourceOf(
  sheet: TargetSheet,
  group: ShotGroup | undefined,
): Promise<ZeroTargetSource> {
  const load = await stored(sheet.load)
  const data = load?.kind === 'load' ? load.data : undefined
  const cartridgeRef = data?.cartridge
  const [firearm, cartridge, session] = await Promise.all([
    stored(own(data?.firearm)),
    own(cartridgeRef)
      ? stored(own(cartridgeRef))
      : cartridgeRef
        ? fetchRecord<{ name?: string | undefined }>('cartridges', cartridgeRef).catch(
            () => undefined,
          )
        : undefined,
    stored(own(sessionRefOf(group))),
  ])
  return {
    group,
    firearm: firearm?.kind === 'firearm' ? firearm.name : undefined,
    cartridge: cartridge?.name,
    date: session?.kind === 'session' ? session.data.date : undefined,
  }
}

/**
 * The page bar's Zero target menu: an A4 grid target with four corner marks for the photo
 * calibration, its fields filled from the open sheet or blank, printed alone while
 * `<html data-print="zero-target">` is set, or saved as SVG.
 */
export function ZeroTargetMenu({
  sheet,
  group,
}: {
  sheet: TargetSheet
  /** The active group: its name, distance and session fill the fields. */
  group: ShotGroup | undefined
}) {
  const { t } = useTranslation()
  const body = usePortalBody()
  const [svg, setSvg] = useState<string>()
  const image = useRef<HTMLImageElement>(null)

  async function markup(blank: boolean) {
    const source = blank ? undefined : await sourceOf(sheet, group).catch(() => undefined)
    return zeroTargetSvg({
      labels: {
        rifle: t('Rifle'),
        date: t('Date'),
        caliber: t('Caliber'),
        shooter: t('Shooter'),
        distance: t('Distance (m)'),
        group: t('Group'),
      },
      values: zeroTargetValues(source),
      check: t('Print at 100 %, not fitted to the page. Check the bar with a ruler.'),
      footer: t(
        'Zero target {id}, version {version}, plain corner marks, mark centres {width} x {height} mm, grid {pitch} mm',
        {
          id: targetId,
          version: formatVersion,
          width: markSpacing.width,
          height: markSpacing.height,
          pitch: gridPitch,
        },
      ),
      plus: '+5 cm',
      minus: '-5 cm',
    })
  }

  async function printTarget(blank: boolean) {
    const s = await markup(blank)
    flushSync(() => setSvg(s))
    await image.current?.decode().catch(() => {})
    printAlone('zero-target', () => setSvg(undefined))
  }

  async function save(blank: boolean) {
    const s = await markup(blank)
    download(
      new Blob([s], { type: 'image/svg+xml' }),
      blank ? 'zero-target-blank.svg' : 'zero-target.svg',
    )
  }

  return (
    <>
      {/* opened by the page bar's first click, which loaded this module */}
      <Menu position="bottom-end" withInitialFocusPlaceholder={false} defaultOpened>
        <Menu.Target>
          <Button variant="default">{t('Zero target')}</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            onClick={() => printTarget(false)}
            title={t(
              "A4 grid target with corner marks for the photo, the fields from this sheet's load and group",
            )}
          >
            {t('Print zero target')}
          </Menu.Item>
          <Menu.Item onClick={() => printTarget(true)}>{t('Print blank zero target')}</Menu.Item>
          <Menu.Divider />
          <Menu.Item onClick={() => save(false)}>{t('Download SVG')}</Menu.Item>
          <Menu.Item onClick={() => save(true)}>{t('Download blank SVG')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {body &&
        svg &&
        createPortal(
          <div className="zero-target">
            {/* biome-ignore lint/performance/noImgElement: the sheet's own SVG at true size, for print only */}
            <img
              ref={image}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
              alt=""
            />
          </div>,
          body,
        )}
    </>
  )
}
