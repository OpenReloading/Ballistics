import type { Projectile } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import { bulletDrag } from '../lib/bullet.ts'
import { type DropSlopeLoad, dropSlope } from '../lib/ladder-slope.ts'

/**
 * The drop slope at a distance for the load of the Trajectory tab, m per m/s: its bullet record
 * read once per bullet, with the G7 ballistic coefficient the tab starts with, else the G1. A
 * function of the distance that gives undefined while the record is not read, for a bullet whose
 * coefficients need a choice, and for a load the trajectory cannot be flown for.
 */
export function useDropSlope(
  load: DropSlopeLoad & { bullet?: string | undefined },
): (distance: number) => number | undefined {
  const { bullet, ...values } = load
  const [read, setRead] = useState<{ bullet: string; projectile: Projectile | undefined }>()
  useEffect(() => {
    if (!bullet) return
    const controller = new AbortController()
    fetchRecord<Bullet>('bullets', bullet, controller.signal)
      .then((record) => {
        const drag = record && [bulletDrag(record, 'G7'), bulletDrag(record, 'G1')]
        const found = drag?.find((d) => d.kind === 'bands')
        setRead({ bullet, projectile: found?.kind === 'bands' ? found.projectile : undefined })
      })
      .catch(() => setRead({ bullet, projectile: undefined }))
    return () => controller.abort()
  }, [bullet])
  const projectile = read && read.bullet === bullet ? read.projectile : undefined
  const { muzzleVelocity, twist, sightHeight, zeroRange } = values
  const { zeroTemperature, zeroPressure, zeroHumidity, dragFactor } = values
  return useMemo(
    () => (distance: number) =>
      projectile &&
      dropSlope(
        {
          muzzleVelocity,
          twist,
          sightHeight,
          zeroRange,
          zeroTemperature,
          zeroPressure,
          zeroHumidity,
          dragFactor,
        },
        projectile,
        distance,
      ),
    [
      projectile,
      muzzleVelocity,
      twist,
      sightHeight,
      zeroRange,
      zeroTemperature,
      zeroPressure,
      zeroHumidity,
      dragFactor,
    ],
  )
}
