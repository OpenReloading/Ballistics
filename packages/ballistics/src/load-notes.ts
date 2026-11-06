/**
 * Notes on a saved load for the sessions it was shot in: the rules and thresholds of
 * `apps/docs/docs/models/load-notes.md`. A note says what differs between two sessions and where
 * the values come from. It is no verdict about a load and recommends no charge.
 */

/** The rule behind a note: a lot, the seating, the mean velocity or the firearm's round count. */
export type LoadNoteRule =
  | 'powderLot'
  | 'primerLot'
  | 'caseLot'
  | 'seating'
  | 'velocity'
  | 'roundCount'

/** The seating length of a session: the length it is measured by, and that length in mm. */
export interface SeatingReading {
  by: 'overallLength' | 'baseToOgive'
  value: number
}

/** The velocity statistics of a session's strings of the load, m/s. */
export interface VelocityReading {
  mean: number
  /** Sample standard deviation; undefined below two counted shots. */
  standardDeviation?: number | undefined
  count: number
}

/** What the notes know of one session of a load. */
export interface SessionReading {
  id: string
  /** ISO day. */
  date?: string | undefined
  powderLot?: string | undefined
  primerLot?: string | undefined
  caseLot?: string | undefined
  seating?: SeatingReading | undefined
  /** Rounds through the firearm at the session. */
  roundCount?: number | undefined
  velocity?: VelocityReading | undefined
  /** Rules whose note on this session the user dismissed. */
  dismissed?: readonly string[] | undefined
}

/** A lot changed from the earlier session's, or is not recorded. */
export interface LotNote {
  rule: 'powderLot' | 'primerLot' | 'caseLot'
  session: string
  /** The session before, when there is one. */
  earlier?: string | undefined
  change: 'changed' | 'missing'
  now?: string | undefined
  before?: string | undefined
}

/** The seating length differs from the earlier session's by more than `seatingTolerance`. */
export interface SeatingNote {
  rule: 'seating'
  session: string
  earlier: string
  by: SeatingReading['by']
  now: number
  before: number
}

/** The mean velocity moved by more than the larger standard deviation of the two sessions. */
export interface VelocityNote {
  rule: 'velocity'
  session: string
  earlier: string
  now: number
  before: number
  /** The larger of the two standard deviations, m/s. */
  spread: number
}

/** The round count passed the user's count between the earlier session and this one. */
export interface RoundCountNote {
  rule: 'roundCount'
  session: string
  earlier: string
  now: number
  before: number
  threshold: number
}

/** One note on a session of a load. */
export type LoadNote = LotNote | SeatingNote | VelocityNote | RoundCountNote

/** Two seating lengths closer than this are the same, mm: the 0.01 mm the fields show. */
export const seatingTolerance = 0.01

const lots = ['powderLot', 'primerLot', 'caseLot'] as const

const lotOf = (s: SessionReading, rule: (typeof lots)[number]) => s[rule]?.trim() || undefined

/** Every session dated: by date, ties and the rest in the order given. */
function inOrder(sessions: readonly SessionReading[]) {
  const dated = sessions.every((s) => s.date !== undefined)
  return dated
    ? [...sessions].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    : [...sessions]
}

const lotNotes = (s: SessionReading, prev: SessionReading | undefined): LotNote[] =>
  lots.flatMap((rule): LotNote[] => {
    const now = lotOf(s, rule)
    const before = prev && lotOf(prev, rule)
    const base = { rule, session: s.id, earlier: prev?.id, now, before }
    if (now === undefined) return [{ ...base, change: 'missing' }]
    return before !== undefined && before !== now ? [{ ...base, change: 'changed' }] : []
  })

function seatingNotes(s: SessionReading, prev: SessionReading): SeatingNote[] {
  const [now, before] = [s.seating, prev.seating]
  if (!now || !before || now.by !== before.by) return []
  if (Math.abs(now.value - before.value) <= seatingTolerance) return []
  return [
    {
      rule: 'seating',
      session: s.id,
      earlier: prev.id,
      by: now.by,
      now: now.value,
      before: before.value,
    },
  ]
}

function velocityNotes(s: SessionReading, prev: SessionReading): VelocityNote[] {
  const [now, before] = [s.velocity, prev.velocity]
  if (now?.standardDeviation === undefined || before?.standardDeviation === undefined) return []
  const spread = Math.max(now.standardDeviation, before.standardDeviation)
  if (Math.abs(now.mean - before.mean) <= spread) return []
  return [
    {
      rule: 'velocity',
      session: s.id,
      earlier: prev.id,
      now: now.mean,
      before: before.mean,
      spread,
    },
  ]
}

function roundCountNotes(
  s: SessionReading,
  prev: SessionReading,
  threshold: number | undefined,
): RoundCountNote[] {
  const [now, before] = [s.roundCount, prev.roundCount]
  if (threshold === undefined || now === undefined || before === undefined) return []
  if (before >= threshold || now < threshold) return []
  return [{ rule: 'roundCount', session: s.id, earlier: prev.id, now, before, threshold }]
}

/** The notes of `s` against the one before it, without the ones it dismissed. */
function sessionNotes(
  s: SessionReading,
  prev: SessionReading | undefined,
  threshold: number | undefined,
): LoadNote[] {
  const notes: LoadNote[] = [
    ...lotNotes(s, prev),
    ...(prev
      ? [
          ...seatingNotes(s, prev),
          ...velocityNotes(s, prev),
          ...roundCountNotes(s, prev, threshold),
        ]
      : []),
  ]
  return notes.filter((n) => !s.dismissed?.includes(n.rule))
}

/**
 * The notes on the sessions of a load: each session against the one before it. The sessions are
 * ordered by date when all have one, else as given. `roundCountThreshold` is the count the user
 * set on the firearm; without it there is no round count note.
 */
export function loadNotes(
  sessions: readonly SessionReading[],
  roundCountThreshold?: number,
): LoadNote[] {
  const ordered = inOrder(sessions)
  return ordered.flatMap((s, i) => sessionNotes(s, ordered[i - 1], roundCountThreshold))
}
