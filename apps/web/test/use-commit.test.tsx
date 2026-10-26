import { createRef } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { useCommit } from '../src/components/use-commit.ts'

describe('useCommit', () => {
  it('does not write the ref in a render that does not commit', () => {
    const ref = createRef<number>() as { current: number }
    ref.current = 0
    const Probe = ({ value }: { value: number }) => {
      useCommit(ref, value)
      return null
    }
    // the server render runs the component but no layout effect: nothing is committed
    renderToString(<Probe value={1} />)
    expect(ref.current).toBe(0)
  })
})
