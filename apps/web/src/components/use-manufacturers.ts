'use client'

import type { UserRecord } from '@openreloading/schema'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ManufacturerSummary } from '../lib/api-types.ts'
import {
  fetchManufacturers,
  type KnownManufacturer,
  knownManufacturers,
  manufacturerNames,
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
  /** The reference `typed` stands for, `id` the UUID of a new manufacturer; nothing is stored. */
  const preview = useCallback(
    (typed: string, id: string) => referTo(latest.current, typed, () => id, new Date())?.ref,
    [],
  )
  /** As `preview`, and stores the new user manufacturer under `id`. */
  const ensure = useCallback((typed: string, id: string): string | undefined => {
    const to = referTo(latest.current, typed, () => id, new Date())
    if (to?.created) {
      const record = to.created
      latest.current = [
        ...latest.current,
        { ref: to.ref, name: record.name, aliases: [] } satisfies KnownManufacturer,
      ]
      setMine((m) => [...m, record])
      // a store that refuses leaves the reference to be reported as missing on the next open
      putRecords([record]).catch(() => {})
    }
    return to?.ref
  }, [])
  return {
    known,
    names,
    preview,
    ensure,
    newId,
    nameOf: (ref: string | undefined) => refName(names, ref),
  }
}
