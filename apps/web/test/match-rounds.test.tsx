import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { MatchReadout, MatchRounds } from '../src/components/match-rounds.tsx'
import { matchCourse, matchRounds } from '../src/lib/match-rounds.ts'

const fields = { shots: 60, sighters: 0, events: 1, reserve: 10, onHand: undefined }

it('counts alternative faces of the whole discipline once', () => {
  expect(matchCourse([{ shotCount: 60 }, { shotCount: 60 }], { sighters: 10 })).toEqual({
    shots: 60,
    sighters: 10,
    openSighters: undefined,
  })
})

it('sums one count per stage and lets a stage replace the discipline sighters', () => {
  const course = matchCourse(
    [
      { stage: 'precision', shotCount: 30, sighters: 5 },
      { stage: 'precision', shotCount: 30 },
      { stage: 'rapid', shotCount: 30 },
    ],
    { sighters: 3 },
  )
  expect(course).toEqual({ shots: 60, sighters: 8, openSighters: undefined })
})

it('leaves out the shots where a stage states no count and names unlimited sighters first', () => {
  expect(matchCourse([{ stage: 'a', shotCount: 20 }, { stage: 'b' }], undefined)).toEqual({
    shots: undefined,
    sighters: 0,
    openSighters: 'not-stated',
  })
  expect(
    matchCourse(
      [{ stage: 'a', sighters: 'unlimited' }, { stage: 'b', sighters: 4 }, { stage: 'c' }],
      {},
    ),
  ).toEqual({ shots: undefined, sighters: 4, openSighters: 'unlimited' })
  expect(matchCourse([], { sighters: 5 }).shots).toBeUndefined()
})

it('rounds up the shots and sighters with the reserve over the events', () => {
  expect(matchRounds(fields)).toEqual({ needed: 66 })
  expect(matchRounds({ ...fields, sighters: 1, events: 3, onHand: 90 })).toEqual({
    needed: 202,
    difference: -112,
  })
  expect(matchRounds({ ...fields, reserve: 0, onHand: 70 })).toEqual({ needed: 60, difference: 10 })
  expect(matchRounds({ ...fields, shots: 7, reserve: 0.5 })).toEqual({ needed: 8 })
})

it('gives no result for 0 events or an empty field it needs', () => {
  expect(matchRounds({ ...fields, events: 0 })).toBeUndefined()
  expect(matchRounds({ ...fields, events: undefined })).toBeUndefined()
  expect(matchRounds({ ...fields, shots: undefined })).toBeUndefined()
  expect(matchRounds({ ...fields, sighters: undefined })).toBeUndefined()
  expect(matchRounds({ ...fields, reserve: undefined })).toBeUndefined()
  expect(matchRounds({ ...fields, shots: 0 })).toBeUndefined()
})

it('renders the derived shots with the result, or the typed field where no target states a count', () => {
  const page = (course: Parameters<typeof matchCourse>[0]) =>
    renderToStaticMarkup(
      <MantineProvider>
        <MatchRounds course={matchCourse(course, { sighters: 'unlimited' })} />
      </MantineProvider>,
    )
  const counted = page([{ shotCount: 60 }, { shotCount: 60 }])
  expect(counted).toContain('Shots per event: 60')
  expect(counted).toContain('Rule book: Any number')
  expect(counted).toMatch(/role="status".*<dt>Rounds needed<\/dt><dd>66<\/dd>/)
  // the fields in planning order: events, sighters, reserve, rounds on hand
  const labels = [...counted.matchAll(/<label[^>]*>([^<]+)</g)].map((m) => m[1])
  expect(labels).toEqual(['Events', 'Sighters per event', 'Reserve, %', 'Rounds on hand'])
  const typed = page([{}])
  expect(typed).toContain('The targets of this discipline state no shot count.')
  expect(typed).toMatch(/role="status"[^>]*><\/div>/)
  expect([...typed.matchAll(/<label[^>]*>([^<]+)</g)].map((m) => m[1])[0]).toBe('Shots per event')
  for (const out of [counted, typed])
    expect(out).not.toMatch(/\b(safe|enough|ready|recommended)\b/i)
})

it('reads out the rounds needed and, with rounds on hand, the rounds short or left over', () => {
  const readout = (result: ReturnType<typeof matchRounds>) =>
    renderToStaticMarkup(<MatchReadout result={result} />)
  expect(readout({ needed: 66 })).toBe(
    '<div role="status"><dl class="readouts match-readouts"><div><dt>Rounds needed</dt><dd>66</dd></div></dl></div>',
  )
  expect(readout({ needed: 202, difference: -112 })).toContain(
    '<dt>Rounds short</dt><dd class="exceeded">112</dd>',
  )
  expect(readout({ needed: 60, difference: 10 })).toContain('<dt>Rounds left over</dt><dd>10</dd>')
  expect(readout({ needed: 60, difference: 0 })).toContain('<dt>Rounds left over</dt><dd>0</dd>')
  expect(readout(undefined)).toBe('<div role="status"></div>')
})
