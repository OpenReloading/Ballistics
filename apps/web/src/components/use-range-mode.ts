'use client'

import { type Load, type SessionRecord, toSi, userRecord } from '@open-reloading/schema'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { errorText } from '../lib/error-text.ts'
import {
  addShot,
  localDate,
  parseVelocity,
  parseWeather,
  type RangeContext,
  type RangeStep,
  rangeSessionId,
  rangeSteps,
  setExcluded,
  setNotes,
  stringIndex,
  type WeatherText,
  withSession,
} from '../lib/range-entry.ts'
import { fixedFieldText } from '../lib/units.ts'
import {
  requestPersistentStorage,
  storedRecord,
  storedRecords,
  updateRecord,
} from '../lib/user-store.ts'
import { useUnits } from './units-settings.tsx'

const subscribe = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

/** Whether the browser reports a network; true while hydrating. */
export const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )

/** A saved load of this browser as the page lists it. */
export interface RangeLoad {
  id: string
  name: string
  data: Load
}

/** The reference a load or session record has as another record's reference. */
const userRef = (id: string) => `user:${id}`

/** Names the session in the stored load, with the snapshot of the load as it is, in one transaction. */
async function linkSession(load: RangeLoad, ref: string) {
  const firearm = load.data.firearm?.startsWith('user:') ? load.data.firearm.slice(5) : undefined
  const stored = firearm ? userRecord.safeParse(await storedRecord(firearm)) : undefined
  const roundCount =
    stored?.success && stored.data.kind === 'firearm' ? stored.data.data.roundCount : undefined
  await updateRecord(load.id, (raw) => {
    const found = userRecord.safeParse(raw)
    if (!found.success) throw new Error('The stored load is not a valid load.')
    return withSession(found.data, ref, roundCount, new Date())
  })
}

const noWeather: WeatherText = { temperature: '', pressure: '', wind: '' }

/**
 * The state and actions of the range page: the saved loads of this browser, the load and ladder step
 * chosen, the entry text and the session of the day. The session record is the entry itself: each
 * action is written to the browser store (one transaction that reads the stored record and applies
 * the change to it) and shown once that write has committed.
 */
export function useRangeMode() {
  const { system } = useUnits()
  const [loads, setLoads] = useState<RangeLoad[]>()
  const [failure, setFailure] = useState<string>()
  const [loadId, setLoadId] = useState<string>()
  const [session, setSession] = useState<SessionRecord>()
  const [stepKey, setStepKey] = useState<string>()
  const [entry, setEntry] = useState('')
  const [weather, setWeather] = useState<WeatherText>(noWeather)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string>()
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const linked = useRef('')

  useEffect(() => {
    storedRecords()
      .then(({ records }) => {
        const list = records.flatMap((r) =>
          r.kind === 'load' ? [{ id: r.id, name: r.name, data: r.data }] : [],
        )
        setLoads(list)
        const asked = new URLSearchParams(window.location.search).get('load')
        const first = list.find((l) => l.id === asked) ?? (list.length === 1 ? list[0] : undefined)
        if (first) setLoadId(first.id)
        setStepKey(new URLSearchParams(window.location.search).get('step') ?? undefined)
      })
      .catch((e: unknown) => setFailure(errorText(e)))
  }, [])

  const load = loads?.find((l) => l.id === loadId)
  const steps = load ? rangeSteps(load.data) : []
  const step: RangeStep | undefined =
    steps.find((s) => s.key === stepKey) ?? steps.find((s) => s.offset === 0) ?? steps[0]
  const index = step ? stringIndex(session, step) : -1
  const string = session?.data.strings[index]

  // the session of the day for the chosen load, when a shot was entered before
  useEffect(() => {
    setSession(undefined)
    setSaved('')
    setProblem(undefined)
    linked.current = ''
    if (!loadId) return
    let current = true
    storedRecord(rangeSessionId(userRef(loadId), localDate(new Date())))
      .then((raw) => {
        const found = raw === undefined ? undefined : userRecord.safeParse(raw)
        if (current && found?.success && found.data.kind === 'session') setSession(found.data)
      })
      .catch((e: unknown) => current && setProblem(errorText(e)))
    const url = new URL(window.location.href)
    url.searchParams.set('load', loadId)
    window.history.replaceState(null, '', url)
    return () => {
      current = false
    }
  }, [loadId])

  // the fields show the stored values of the string of the chosen step
  // biome-ignore lint/correctness/useExhaustiveDependencies: the string changes with these
  useEffect(() => {
    const c = string?.conditions
    const at = (q: 'temperature' | 'airPressure' | 'windSpeed', si: number | undefined) =>
      si === undefined ? '' : fixedFieldText(q, system, si)
    setWeather({
      temperature: at(
        'temperature',
        c?.airTemperature && toSi('temperature', c.airTemperature.value),
      ),
      pressure: at('airPressure', c?.stationPressure && toSi('pressure', c.stationPressure.value)),
      wind: at('windSpeed', c?.windSpeed && toSi('velocity', c.windSpeed.value)),
    })
    setNote(string?.note ?? '')
  }, [step?.key, loadId, session?.id, system])

  const context = (): RangeContext | undefined =>
    load && loadId
      ? {
          id: rangeSessionId(userRef(loadId), localDate(new Date())),
          name: `${load.name}, range ${localDate(new Date())}`,
          loadRef: userRef(loadId),
          now: new Date(),
        }
      : undefined

  /** Writes a change of the session `id` and shows the record written; the text is the confirmation read out. */
  const commit = useCallback(
    async (id: string, change: (stored: unknown) => SessionRecord, confirmation: string) => {
      if (!loadId) return false
      setSaving(true)
      setProblem(undefined)
      try {
        const written = await updateRecord(id, change)
        if (written?.kind === 'session') setSession(written)
        setSaved(confirmation)
        const key = `${loadId}:${id}`
        if (linked.current !== key) {
          if (load) await linkSession(load, userRef(id))
          linked.current = key
        }
        return true
      } catch (e) {
        setProblem(errorText(e))
        setSaved('')
        return false
      } finally {
        setSaving(false)
      }
    },
    [loadId, load],
  )

  const velocity = system.velocity
  const append = (text: string) => setEntry((e) => (e + text).slice(0, 8))
  const erase = () => setEntry((e) => e.slice(0, -1))

  /** Stores the typed velocity as the next shot of the chosen step. */
  async function add() {
    const c = context()
    if (!c || !step || saving) return
    const parsed = parseVelocity(entry, velocity.toSi)
    if ('error' in parsed) return setProblem(parsed.error)
    const typed = parseWeather(weather, system)
    if ('error' in typed) return setProblem(typed.error)
    void requestPersistentStorage()
    const n = (string?.shots.length ?? 0) + 1
    const ok = await commit(
      c.id,
      addShot(c, step, parsed.velocity, { conditions: typed.conditions, note }),
      `Shot ${n} saved on this device.`,
    )
    if (ok) setEntry('')
  }

  /** Marks shot `index` excluded, or takes the mark off. */
  async function exclude(index: number, excluded: boolean) {
    const c = context()
    if (!c || !step) return
    await commit(
      c.id,
      setExcluded(c, step, index, excluded),
      `Shot ${index + 1} ${excluded ? 'excluded' : 'included'}.`,
    )
  }

  /** Stores the weather and the note of a string that has shots; a string without one keeps them until its first shot. */
  async function keep(next: { weather: WeatherText; note: string }) {
    setWeather(next.weather)
    setNote(next.note)
    const c = context()
    if (!c || !step || index < 0) return
    const typed = parseWeather(next.weather, system)
    if ('error' in typed) return setProblem(typed.error)
    await commit(
      c.id,
      setNotes(c, step, { conditions: typed.conditions, note: next.note }),
      'Conditions and note saved on this device.',
    )
  }

  return {
    system,
    loads,
    failure,
    load,
    loadId,
    choose: setLoadId,
    steps,
    step,
    chooseStep: (key: string) => {
      setStepKey(key)
      const url = new URL(window.location.href)
      url.searchParams.set('step', key)
      window.history.replaceState(null, '', url)
    },
    session,
    string,
    entry,
    setEntry,
    append,
    erase,
    add,
    exclude,
    weather,
    note,
    keep,
    problem,
    saved,
    saving,
  }
}
