import type { Projectile } from '@open-reloading/ballistics'
import type { Bullet } from '@open-reloading/schema'
import { useEffect, useMemo, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import { bulletDrag } from '../lib/bullet.ts'
import { type DropSlopeLoad, dropSlope } from '../lib/ladder-slope.ts'

/** Drop slope, m per m/s, with the G7 coefficient the tab starts with (G1 only without a G7); undefined while the record is not read, when the coefficients need a choice, or for a load the trajectory cannot be flown for. */
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
