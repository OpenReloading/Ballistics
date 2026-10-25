'use client'

import type { UserRecord } from '@open-reloading/schema'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ManufacturerSummary } from '../lib/api-types.ts'
import {
  fetchManufacturers,
  knownManufacturers,
  manufacturerNames,
  newManufacturerRecord,
  referTo,
  refName,
  withUserManufacturers,
} from '../lib/manufacturers.ts'
import { newId } from '../lib/new-id.ts'
import { putRecords, storedRecords } from '../lib/user-store.ts'

/**
 * The manufacturers a user can name: the catalogue's and the browser's, read after mounting.
 * `ensure` turns a typed name into a reference: the manufacturer it names, else a new user
 * manufacturer, stored here and found by the next typed name.
 */
export function useManufacturers() {
  const [catalogue, setCatalogue] = useState<ManufacturerSummary[]>([])
  const [mine, setMine] = useState<UserRecord[]>([])
  useEffect(() => {
    let live = true
    // without the catalogue a typed name can only match the user's own manufacturers
    fetchManufacturers().then(
      (m) => live && setCatalogue(m),
      () => {},
    )
    storedRecords().then(
      (r) => live && setMine((m) => [...m, ...r.records.filter((x) => x.kind === 'manufacturer')]),
      () => {},
    )
    return () => {
      live = false
    }
  }, [])
  const known = useMemo(() => knownManufacturers(catalogue, mine), [catalogue, mine])
  const names = useMemo(
    () => withUserManufacturers(manufacturerNames(catalogue), mine),
    [catalogue, mine],
  )
  const latest = useRef(known)
  latest.current = known
  /**
   * The reference `typed` stands for, `id` the UUID of a new manufacturer. A new one is kept as a
   * draft (its name is known to `nameOf`, nothing is stored) that the next call for `id` replaces
   * or drops.
   */
  const preview = useCallback((typed: string, id: string) => {
    const to = referTo(
      latest.current.filter((m) => m.ref !== `user:${id}`),
      typed,
      () => id,
      new Date(),
    )
    setMine((m) => [...m.filter((r) => r.id !== id), ...(to?.created ? [to.created] : [])])
    return to?.ref
  }, [])
  /** As `preview`, and stores the new user manufacturer under `id`. */
  const ensure = useCallback(
    (typed: string, id: string) => {
      const ref = preview(typed, id)
      const created = ref === `user:${id}`
      // a store that refuses leaves the reference to be reported as missing on the next open
      if (created) putRecords([newManufacturerRecord(id, typed, new Date())]).catch(() => {})
      return ref
    },
    [preview],
  )
  const nameOf = useCallback((ref: string | undefined) => refName(names, ref), [names])
  return {
    known,
    names,
    preview,
    ensure,
    newId,
    nameOf,
  }
}
