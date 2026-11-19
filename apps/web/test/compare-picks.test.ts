import { expect, it } from 'vitest'
import { usePicks } from '../src/components/compare-picks.tsx'

it('takes an id repeated in the URL once, in the order first ticked', () => {
  const [picked] = usePicks(
    4,
    'b,a,b,c',
    () => {},
    () => true,
  )
  expect(picked).toEqual(['b', 'a', 'c'])
})
