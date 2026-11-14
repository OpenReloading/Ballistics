# @rangefoundry/shot-groups

Scores shots: the ring value of a hole on a rule-book target face, the hit probability and expected score of a point dispersion, the totals of ring series and practical stages, and the photo geometry and ellipse fits that place a target sheet. A refusal carries a typed issue `{ code, params }` and no text (the `InputError` of `@rangefoundry/statistics` with its `issue`, or `{ issue }` from the ring-mark fits), so the caller words it in its language. Its dependencies are `@rangefoundry/units` and `@rangefoundry/statistics`. Private to this repository: it is not published.

```js
import { InputError } from '@rangefoundry/statistics'
import { ringTotal } from '@rangefoundry/shot-groups'

ringTotal({ shots: [10.4, 10.2] }) // 20.6
try {
  ringTotal({})
} catch (e) {
  if (e instanceof InputError) e.issue // { code: 'series-total', params: {} }
}
```

License: MIT
