'use client'

import { type Load, parseRef, type SessionRecord, toSi, userRecord } from '@open-reloading/schema'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Translator } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { errorText } from '../lib/error-text.ts'
import { roundsDue, withSessionRounds } from '../lib/firearm.ts'
import {
  addShot,
  type ComponentKind,
  componentRefs,
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
  typedRounds,
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

/**
 * The names of the records `load` names: a record of this browser from the store, a catalogue record
 * from the API; none for a reference that cannot be read (offline, or deleted).
 */
async function componentNames(load: Load) {
  const names = new Map<string, string>()
  await Promise.all(
    componentRefs(load).map(async ([kind, ref]) => {
      const record = await namedRecord(kind, ref)
      if (typeof record?.name !== 'string') return
      // a bullet or powder record names its product only ("2015"): its manufacturer comes first
      const maker =
        kind === 'bullets' || kind === 'powders'
          ? (await namedRecord('manufacturers', manufacturerRef(record.manufacturer)))?.name
          : undefined
      const name =
        typeof maker === 'string' && !record.name.startsWith(maker)
          ? `${maker} ${record.name}`
          : record.name
      names.set(`${kind} ${ref}`, name)
    }),
  )
  return (kind: ComponentKind, ref: string) => names.get(`${kind} ${ref}`)
}

/** A catalogue manufacturer id or a reference as a reference, undefined for anything else. */
const manufacturerRef = (m: unknown) =>
  typeof m !== 'string' ? undefined : parseRef(m) ? m : `catalogue:${m}`

/** The record a reference names, from this browser's store or the API; undefined when it cannot be read. */
async function namedRecord(
  kind: string,
  ref: string | undefined,
): Promise<{ name?: unknown; manufacturer?: unknown } | undefined> {
  const target = ref ? parseRef(ref) : undefined
  if (!target) return undefined
  if (target.scope === 'user') {
    const r = await storedRecord(target.id).catch(() => undefined)
    return r && { name: r.name, manufacturer: (r.data as { manufacturer?: unknown }).manufacturer }
  }
  return fetchRecord<{ name?: unknown; manufacturer?: unknown }>(kind, target.id).catch(
    () => undefined,
  )
}

/** The reference a load or session record has as another record's reference. */
const userRef = (id: string) => `user:${id}`

/** The firearm of a load as a store id, for a `user:` reference only. */
const firearmIdOf = (load: RangeLoad) =>
  load.data.firearm?.startsWith('user:') ? load.data.firearm.slice(5) : undefined

/** Names the session in the stored load, with the snapshot of the load as it is, in one transaction. */
async function linkSession(load: RangeLoad, ref: string, t: Translator['t']) {
  const firearm = firearmIdOf(load)
  const stored = firearm ? userRecord.safeParse(await storedRecord(firearm)) : undefined
  const roundCount =
    stored?.success && stored.data.kind === 'firearm' ? stored.data.data.roundCount : undefined
  await updateRecord(load.id, (raw) => {
    const found = userRecord.safeParse(raw)
    if (!found.success) throw new Error(t('The stored load is not a valid load.'))
    return withSession(found.data, ref, roundCount, new Date(), t)
  })
}

/**
 * The rounds of a session the firearm's round count does not hold yet (`shots`), of the session's
 * `total` shots; `base` is the count when the session began.
 */
type RoundOffer = {
  firearm: string
  name: string
  session: string
  base: number | undefined
  total: number
  shots: number
}

/**
 * The offer for the session `ref` of `load`, read from the store: undefined for a firearm not of
 * this browser, without a count, or that holds the session's shots already.
 */
async function roundOfferOf(load: RangeLoad, ref: string, shots: number) {
  const id = firearmIdOf(load)
  if (!id || shots < 1) return
  const [gun, stored] = await Promise.all([storedRecord(id), storedRecord(load.id)])
  const f = userRecord.safeParse(gun)
  const l = userRecord.safeParse(stored)
  if (!f.success || f.data.kind !== 'firearm' || !l.success || l.data.kind !== 'load') return
  const base = l.data.data.snapshots?.find((s) => s.session === ref)?.roundCount
  const due = roundsDue(f.data.data, ref, base, shots)
  if (due < 1) return
  return { firearm: id, name: f.data.name, session: ref, base, total: shots, shots: due }
}

const noWeather: WeatherText = { temperature: '', pressure: '', wind: '' }

const draftKey = (session: string, step: string) => `range-draft:${session}:${step}`

/** The weather and note typed for a string before its first shot, kept in this browser until then. */
function readDraft(key: string): { weather: WeatherText; note: string } | undefined {
  try {
    const d: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    const w = (d as { weather?: Record<string, unknown> } | null)?.weather
    const note = (d as { note?: unknown } | null)?.note
    return w && typeof note === 'string'
      ? {
          weather: {
            temperature: String(w.temperature ?? ''),
            pressure: String(w.pressure ?? ''),
            wind: String(w.wind ?? ''),
          },
          note,
        }
      : undefined
  } catch {
    return undefined
  }
}

function writeDraft(key: string, draft: { weather: WeatherText; note: string } | undefined) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft))
    else localStorage.removeItem(key)
  } catch {}
}

/**
 * The state and actions of the range page: the saved loads of this browser, the load and ladder step
 * chosen, the entry text and the session of the day. The session record is the entry itself: each
 * action is written to the browser store (one transaction that reads the stored record and applies
 * the change to it) and shown once that write has committed.
 */
export function useRangeMode() {
  const { t } = useTranslation()
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
  const [roundOffer, setRoundOffer] = useState<RoundOffer>()
  const [rounds, setRounds] = useState('')
  const roundsTyped = typedRounds(rounds)
  const prefilled = useRef('')

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
  // the names of the chosen load's cartridge, bullet, powder and primer, once read
  const [nameOf, setNameOf] = useState<(kind: ComponentKind, ref: string) => string | undefined>()
  useEffect(() => {
    setNameOf(undefined)
    if (!load) return
    let current = true
    void componentNames(load.data).then((f) => current && setNameOf(() => f))
    return () => {
      current = false
    }
  }, [load])
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
    if (!string && loadId && step) {
      // no shot yet: what was typed for it so far, kept in this browser
      const draft = readDraft(
        draftKey(rangeSessionId(userRef(loadId), localDate(new Date())), step.key),
      )
      setWeather(draft?.weather ?? noWeather)
      setNote(draft?.note ?? '')
      return
    }
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

  // every shot of the session was fired, an excluded one too
  const sessionShots = session?.data.strings.reduce((n, s) => n + s.shots.length, 0) ?? 0
  // read again once the write and the load's snapshot of the session have committed
  useEffect(() => {
    setRoundOffer(undefined)
    if (!load || !session || saving) return
    let current = true
    roundOfferOf(load, userRef(session.id), sessionShots)
      .then((offer) => {
        if (!current) return
        setRoundOffer(offer)
        // another session or a new shot prefills the field again, an exclusion keeps what was typed
        const key = offer ? `${session.id}:${offer.shots}` : ''
        if (offer && key !== prefilled.current) setRounds(String(offer.shots))
        prefilled.current = key
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [load, session, sessionShots, saving])

  const context = (): RangeContext | undefined =>
    load && loadId
      ? {
          id: rangeSessionId(userRef(loadId), localDate(new Date())),
          name: `${load.name.slice(0, 150)}, range ${localDate(new Date())}`,
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
      } catch (e) {
        setProblem(errorText(e))
        setSaved('')
        setSaving(false)
        return false
      }
      // the change is stored: a load that cannot name the session is reported apart, never as a failed save
      try {
        const key = `${loadId}:${id}`
        if (linked.current !== key) {
          if (load) await linkSession(load, userRef(id), t)
          linked.current = key
        }
      } catch (e) {
        setProblem(
          t('Saved, but the load does not list this session yet: {reason}', {
            reason: errorText(e),
          }),
        )
      } finally {
        setSaving(false)
      }
      return true
    },
    [loadId, load, t],
  )

  const velocity = system.velocity
  const append = (text: string) => setEntry((e) => (e + text).slice(0, 8))
  const erase = () => setEntry((e) => e.slice(0, -1))

  /** Stores the typed velocity as the next shot of the chosen step. */
  async function add() {
    const c = context()
    if (!c || !step || saving) return
    const parsed = parseVelocity(entry, velocity.toSi, t)
    if ('error' in parsed) return setProblem(parsed.error)
    const typed = parseWeather(weather, system, t)
    if ('error' in typed) return setProblem(typed.error)
    void requestPersistentStorage()
    const n = (string?.shots.length ?? 0) + 1
    const ok = await commit(
      c.id,
      addShot(c, step, parsed.velocity, { conditions: typed.conditions, note }, t),
      t('Shot {n} saved on this device.', { n }),
    )
    if (ok) {
      setEntry('')
      writeDraft(draftKey(c.id, step.key), undefined)
    }
  }

  /** Marks shot `index` excluded, or takes the mark off. */
  async function exclude(index: number, excluded: boolean) {
    const c = context()
    if (!c || !step) return
    await commit(
      c.id,
      setExcluded(c, step, index, excluded, t),
      excluded
        ? t('Shot {n} excluded.', { n: index + 1 })
        : t('Shot {n} included.', { n: index + 1 }),
    )
  }

  /** Stores the weather and the note of a string that has shots; a string without one keeps them in this browser until its first shot. */
  async function keep(next: { weather: WeatherText; note: string }) {
    setWeather(next.weather)
    setNote(next.note)
    const c = context()
    if (!c || !step) return
    if (index < 0) return writeDraft(draftKey(c.id, step.key), next)
    const typed = parseWeather(next.weather, system, t)
    if ('error' in typed) return setProblem(typed.error)
    await commit(
      c.id,
      setNotes(c, step, { conditions: typed.conditions, note: next.note }, t),
      t('Conditions and note saved on this device.'),
    )
  }

  /** Adds the typed rounds to the firearm's count, unless the session is in it already. */
  async function addRounds() {
    const offer = roundOffer
    if (!offer || saving) return
    const n = roundsTyped
    if (n === undefined) return setProblem(t('Enter a whole number of rounds, 1 or more.'))
    setSaving(true)
    setProblem(undefined)
    try {
      const written = await updateRecord(offer.firearm, (raw) => {
        const found = userRecord.safeParse(raw)
        if (!found.success) return
        return withSessionRounds(found.data, offer.session, offer.base, offer.total, n, new Date())
      })
      setSaved(
        written?.kind === 'firearm' && written.data.roundCount !== undefined
          ? t('Round count of {name}: {count}.', {
              name: offer.name,
              count: written.data.roundCount,
            })
          : t('The round count of {name} holds this session already.', {
              name: offer.name,
            }),
      )
    } catch (e) {
      setProblem(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return {
    system,
    loads,
    failure,
    load,
    loadId,
    nameOf,
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
    roundOffer,
    rounds,
    roundsTyped,
    setRounds,
    addRounds,
  }
}
