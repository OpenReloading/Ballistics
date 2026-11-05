import { describe, expect, it } from 'vitest'
import { referenceOf } from '../src/lib/target-editor.ts'

const [a, b, c, d] = [
  { x: 1, y: 2 },
  { x: 30, y: 2 },
  { x: 30, y: 40 },
  { x: 1, y: 40 },
]

describe('referenceOf', () => {
  it('builds each kind from its points and known size', () => {
    expect(referenceOf('line', { length: 0.1 }, [a, b])).toEqual({
      kind: 'line',
      a,
      b,
      length: 0.1,
    })
    expect(referenceOf('ringCentre', { length: 0.05 }, [a, b])).toEqual({
      kind: 'ringCentre',
      centre: a,
      edge: b,
      diameter: 0.05,
    })
    expect(referenceOf('ringEdge', { length: 0.05 }, [a, b, c])).toEqual({
      kind: 'ringEdge',
      points: [a, b, c],
      diameter: 0.05,
    })
    expect(referenceOf('rectangle', { width: 0.2, height: 0.3 }, [a, b, c, d])).toEqual({
      kind: 'rectangle',
      corners: [a, b, c, d],
      width: 0.2,
      height: 0.3,
    })
  })

  it('takes the length for a line or ring and the width and height for a rectangle', () => {
    expect(referenceOf('line', { width: 0.2, height: 0.3 }, [a, b])).toBeUndefined()
    expect(referenceOf('ringCentre', { length: 0 }, [a, b])).toBeUndefined()
    expect(referenceOf('ringEdge', {}, [a, b, c])).toBeUndefined()
    expect(referenceOf('rectangle', { length: 0.1, width: 0.2 }, [a, b, c, d])).toBeUndefined()
    expect(referenceOf('rectangle', { width: 0.2, height: 0 }, [a, b, c, d])).toBeUndefined()
  })

  it('needs every point of its kind', () => {
    expect(referenceOf('line', { length: 0.1 }, [a])).toBeUndefined()
    expect(referenceOf('ringCentre', { length: 0.1 }, [])).toBeUndefined()
    expect(referenceOf('ringEdge', { length: 0.1 }, [a, b])).toBeUndefined()
    expect(referenceOf('rectangle', { width: 0.2, height: 0.3 }, [a, b, c])).toBeUndefined()
  })

  it('ignores points past those of its kind', () => {
    expect(referenceOf('line', { length: 0.1 }, [a, b, c])).toEqual({
      kind: 'line',
      a,
      b,
      length: 0.1,
    })
  })
})
