import { toSi } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { type CandidateClass, caliberCandidates } from '../src/lib/caliber-candidates.ts'

const mm = (v: number) => toSi('length', v)
const nine: CandidateClass = {
  id: 'pistol-9mm',
  name: '9 mm pistol',
  diameter: mm(9.04),
  cartridges: ['9-mm-luger'],
}
const magnum: CandidateClass = {
  id: 'revolver-357-38',
  name: '.357 and .38 revolver',
  diameter: mm(9.12),
  cartridges: ['357-magnum'],
}
const acp: CandidateClass = {
  id: 'pistol-45',
  name: '.45 ACP pistol',
  diameter: mm(11.48),
  cartridges: ['45-acp'],
}
const rimfire: CandidateClass = {
  id: 'rimfire-22',
  name: '.22 rimfire',
  diameter: mm(5.6),
  cartridges: ['22-lr'],
}
const bullet = (v: number) => ({ diameter: mm(v), source: 'bullet' })
const ids = (r: { candidates: CandidateClass[] }) => r.candidates.map((c) => c.id)
const none = new Set<string>()

describe('caliberCandidates', () => {
  it('offers every class of the discipline, none preselected without a hole size', () => {
    const r = caliberCandidates([nine, acp], undefined, none)
    expect(ids(r)).toEqual(['pistol-9mm', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it('preselects the class a hole size separates, the other still offered', () => {
    const r = caliberCandidates([nine, acp], bullet(11), none)
    expect(ids(r)).toEqual(['pistol-45', 'pistol-9mm'])
    expect(r.preselected).toBe('pistol-45')
  })

  it('offers both classes of one hole size and preselects neither', () => {
    const r = caliberCandidates([acp, nine, magnum], bullet(9.1), none)
    expect(ids(r).slice(0, 2).toSorted()).toEqual(['pistol-9mm', 'revolver-357-38'])
    expect(r.preselected).toBeUndefined()
  })

  it("puts the user's class first on a tie, still preselecting neither", () => {
    const r = caliberCandidates([nine, magnum, acp], bullet(9.04), new Set(['357-magnum']))
    expect(ids(r)).toEqual(['revolver-357-38', 'pistol-9mm', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it("puts the user's class first without a hole size", () => {
    expect(ids(caliberCandidates([nine, acp], undefined, new Set(['45-acp'])))).toEqual([
      'pistol-45',
      'pistol-9mm',
    ])
  })

  it('preselects nothing on a measured hole and puts the classes it fits first', () => {
    // a 9 mm hole in paper at 0.8 of the bullet: nearer 5.6 mm than 9.04 mm by distance alone
    const r = caliberCandidates([rimfire, nine, acp], { diameter: mm(7.2), source: 'typed' }, none)
    expect(ids(r)).toEqual(['pistol-9mm', 'rimfire-22', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it('offers nothing for a discipline without classes', () => {
    expect(caliberCandidates([], bullet(9), none)).toEqual({
      candidates: [],
      preselected: undefined,
    })
  })
})
