'use client'

import type { UserRecord } from '@open-reloading/schema'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ManufacturerSummary } from '../lib/api-types.ts'
import {
  fetchManufacturers,
  knownManufacturers,
  manufacturerNames,
  manufacturersChanged,
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
 * manufacturer, stored here and found by the next typed name. While the catalogue has not
 * answered (`ready` false) a name that matches no user manufacturer gets no reference and no
 * record, so it cannot duplicate a catalogue manufacturer; `retry` asks the catalogue again.
 */
export function useManufacturers() {
  const [catalogue, setCatalogue] = useState<ManufacturerSummary[]>([])
  const [mine, setMine] = useState<UserRecord[]>([])
  const [ready, setReady] = useState(false)
  const loaded = useRef(false)
  // new names typed and not stored yet: the store does not hold them
  const drafts = useRef(new Set<string>())
  /**
   * Reads the browser's manufacturers again, after a record brought some along or Settings deleted
   * one. Only the drafts stay of what was held.
   */
  const reload = useCallback(
    () =>
      storedRecords().then(
        (r) =>
          setMine((m) => [
            ...m.filter((x) => drafts.current.has(x.id)),
            ...r.records.filter((x) => x.kind === 'manufacturer'),
          ]),
        () => {},
      ),
    [],
  )
  /** Asks the catalogue again; whether it answered. A later `preview` or `ensure` sees it at once. */
  const retry = useCallback(async () => {
    try {
      const m = await fetchManufacturers()
      seen.current = { ...seen.current, catalogue: m }
      loaded.current = true
      setCatalogue(m)
      setReady(true)
      return true
    } catch {
      // without the catalogue a typed name can only match the user's own manufacturers
      return false
    }
  }, [])
  useEffect(() => {
    void retry()
    void reload()
    window.addEventListener(manufacturersChanged, reload)
    return () => window.removeEventListener(manufacturersChanged, reload)
  }, [retry, reload])
  const known = useMemo(() => knownManufacturers(catalogue, mine), [catalogue, mine])
  const names = useMemo(
    () => withUserManufacturers(manufacturerNames(catalogue), mine),
    [catalogue, mine],
  )
  const seen = useRef({ catalogue, mine })
  seen.current = { catalogue, mine }
  /**
   * The reference `typed` stands for, `id` the UUID of a new manufacturer. A new one is kept as a
   * draft (its name is known to `nameOf`, nothing is stored) that the next call for `id` replaces
   * or drops.
   */
  const preview = useCallback((typed: string, id: string) => {
    const to = referTo(
      knownManufacturers(
        seen.current.catalogue,
        seen.current.mine.filter((r) => r.id !== id),
      ),
      typed,
      () => id,
      new Date(),
      loaded.current,
    )
    if (to?.created) drafts.current.add(id)
    else drafts.current.delete(id)
    setMine((m) => [...m.filter((r) => r.id !== id), ...(to?.created ? [to.created] : [])])
    return to?.ref
  }, [])
  /** As `preview`, and stores the new user manufacturer under `id`. */
  const ensure = useCallback(
    (typed: string, id: string) => {
      const ref = preview(typed, id)
      const created = ref === `user:${id}`
      // a store that refuses leaves the reference to be reported as missing on the next open
      if (created) {
        putRecords([newManufacturerRecord(id, typed, new Date())]).catch(() => {})
        drafts.current.delete(id)
      }
      return ref
    },
    [preview],
  )
  return {
    known,
    names,
    ready,
    retry,
    reload,
    preview,
    ensure,
    newId,
    nameOf: (ref: string | undefined) => refName(names, ref),
  }
}
