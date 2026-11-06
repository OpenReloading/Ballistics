import { describe, expect, it } from 'vitest'
import { loadNotes, type SessionReading } from '../src/index.ts'

const s = (id: string, rest: Partial<SessionReading> = {}): SessionReading => ({
  id,
  powderLot: 'P1',
  primerLot: 'R1',
  caseLot: 'C1',
  ...rest,
})
const rules = (sessions: SessionReading[], threshold?: number) =>
  loadNotes(sessions, threshold).map((n) => `${n.session}:${n.rule}`)

describe('loadNotes', () => {
  it('has nothing to say without sessions and none to compare for a first session with lots', () => {
    expect(loadNotes([])).toEqual([])
    expect(rules([s('a')])).toEqual([])
  })

  it('notes a lot that is not recorded, also in the first session', () => {
    expect(rules([s('a', { powderLot: undefined, primerLot: ' ' })])).toEqual([
      'a:powderLot',
      'a:primerLot',
    ])
    const [note] = loadNotes([s('a'), s('b', { caseLot: undefined })])
    expect(note).toMatchObject({ rule: 'caseLot', change: 'missing', earlier: 'a', before: 'C1' })
  })

  it('notes a lot that changed and names both values and sessions', () => {
    expect(loadNotes([s('a'), s('b', { powderLot: 'P2' })])).toEqual([
      {
        rule: 'powderLot',
        session: 'b',
        earlier: 'a',
        change: 'changed',
        now: 'P2',
        before: 'P1',
      },
    ])
    expect(rules([s('a'), s('b', { primerLot: ' R1 ' })])).toEqual([])
  })

  it('compares seating by the same length only, with a tolerance of 0.01 mm', () => {
    const at = (value: number, by: 'overallLength' | 'baseToOgive' = 'overallLength') => ({
      seating: { by, value },
    })
    expect(rules([s('a', at(70)), s('b', at(70.005))])).toEqual([])
    expect(loadNotes([s('a', at(70)), s('b', at(70.5))])).toEqual([
      { rule: 'seating', session: 'b', earlier: 'a', by: 'overallLength', now: 70.5, before: 70 },
    ])
    expect(rules([s('a', at(70)), s('b', at(54, 'baseToOgive'))])).toEqual([])
    expect(rules([s('a', at(70)), s('b')])).toEqual([])
  })

  it('notes a mean velocity that moved by more than the larger standard deviation', () => {
    const v = (mean: number, standardDeviation: number | undefined) => ({
      velocity: { mean, standardDeviation, count: 5 },
    })
    expect(loadNotes([s('a', v(800, 5)), s('b', v(815, 8))])).toEqual([
      { rule: 'velocity', session: 'b', earlier: 'a', now: 815, before: 800, spread: 8 },
    ])
    expect(rules([s('a', v(800, 5)), s('b', v(792, 8))])).toEqual([])
    expect(rules([s('a', v(800, 5)), s('b', v(780, 8))])).toEqual(['b:velocity'])
    // one counted shot has no standard deviation: nothing to compare against
    expect(rules([s('a', v(800, undefined)), s('b', v(900, 1))])).toEqual([])
    expect(rules([s('a', v(800, 5)), s('b')])).toEqual([])
  })

  it('notes the round count passing the user count, once', () => {
    const at = (roundCount: number) => ({ roundCount })
    const sessions = [s('a', at(400)), s('b', at(650)), s('c', at(900))]
    expect(loadNotes(sessions, 500)).toEqual([
      { rule: 'roundCount', session: 'b', earlier: 'a', now: 650, before: 400, threshold: 500 },
    ])
    expect(rules([s('a', at(400)), s('b', at(500))], 500)).toEqual(['b:roundCount'])
    expect(rules(sessions)).toEqual([])
    expect(rules([s('a'), s('b', at(900))], 500)).toEqual([])
    expect(rules([s('a', at(900))], 500)).toEqual([])
  })

  it('leaves out the notes a session dismissed', () => {
    const sessions = [
      s('a'),
      s('b', { powderLot: 'P2', primerLot: 'R2', dismissed: ['powderLot'] }),
    ]
    expect(rules(sessions)).toEqual(['b:primerLot'])
  })

  it('orders the sessions by date when all have one, else as given', () => {
    const late = s('late', { date: '2026-05-01', powderLot: 'P2' })
    const early = s('early', { date: '2026-01-01' })
    expect(loadNotes([late, early])).toMatchObject([{ session: 'late', earlier: 'early' }])
    const undated = s('undated', { powderLot: 'P3' })
    expect(loadNotes([late, early, undated])).toMatchObject([
      { session: 'early', earlier: 'late', before: 'P2' },
      { session: 'undated', earlier: 'early' },
    ])
  })
})
