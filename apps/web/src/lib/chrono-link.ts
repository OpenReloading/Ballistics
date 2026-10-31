import type { GroupShot, SessionRecord } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'
import { sessionRef } from './measurements.ts'
import { stringName } from './string-name.ts'

/** A string of a stored chronograph session a group's shots can be linked to. */
export interface StringChoice {
  session: SessionRecord
  /** Index of the string in the session, from 0. */
  string: number
}

/** Every string of `sessions`, in order. */
export const stringChoices = (sessions: readonly SessionRecord[]): StringChoice[] =>
  sessions.flatMap((session) => session.data.strings.map((_, string) => ({ session, string })))

/** The choice as a line of the picker: session name, string and its shot count. */
export function choiceLabel({ session, string }: StringChoice, t: Translator['t']): string {
  const strings = session.data.strings
  const labels = strings.map((s) => s.label)
  return t('{session}, {string}, {count} shots', {
    session: session.name,
    string: stringName(labels, string, t),
    count: strings[string]?.shots.length ?? 0,
  })
}

/**
 * The shots with the shots of `choice` linked in order: the first included shot takes shot 0 of
 * the string, the next shot 1, and so on. A shot left out of the statistics takes no link and
 * does not use one up; a shot past the end of the string has none. Without a choice every link is
 * removed.
 */
export function linkString(shots: readonly GroupShot[], choice?: StringChoice): GroupShot[] {
  let next = 0
  const count = choice?.session.data.strings[choice.string]?.shots.length ?? 0
  return shots.map(({ chrono: _, ...shot }) => {
    if (!choice || shot.excluded || next >= count) return shot
    return {
      ...shot,
      chrono: { session: sessionRef(choice.session.id), string: choice.string, shot: next++ },
    }
  })
}

/** The session reference and string of the first linked shot: what the picker shows. */
export function linkedString(shots: readonly GroupShot[]) {
  return shots.find((s) => s.chrono)?.chrono
}
