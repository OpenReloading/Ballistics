import type { Projectile } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import { bulletDrag } from '../lib/bullet.ts'
import { type DropSlopeLoad, dropSlope } from '../lib/ladder-slope.ts'

/**
 * The drop slope at a distance for the load of the Trajectory tab, m per m/s: its bullet record
 * read once per bullet, with the G7 ballistic coefficient the tab starts with, the G1 only for a bullet without a G7. A
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
        const g7 = record && bulletDrag(record, 'G7')
        const drag = record && g7?.kind === 'none' ? bulletDrag(record, 'G1') : g7
        setRead({ bullet, projectile: drag?.kind === 'bands' ? drag.projectile : undefined })
      })
      .catch(() => setRead({ bullet, projectile: undefined }))
    return () => controller.abort()
  }, [bullet])
  const projectile = read && read.bullet === bullet ? read.projectile : undefined
  const { muzzleVelocity, twist, sightHeight, zeroRange } = values
  const { zeroTemperature, zeroPressure, zeroHumidity, dragFactor } = values
  return useMemo(() => {
    // an edit of a shot changes the groups, not the load: the slope of a distance is flown once
    const known = new Map<number, number | undefined>()
    return (distance: number) => {
      if (!projectile) return
      if (!known.has(distance))
        known.set(
          distance,
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
        )
      return known.get(distance)
    }
  }, [
    projectile,
    muzzleVelocity,
    twist,
    sightHeight,
    zeroRange,
    zeroTemperature,
    zeroPressure,
    zeroHumidity,
    dragFactor,
  ])
}
