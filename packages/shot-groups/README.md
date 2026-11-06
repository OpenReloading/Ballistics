# @open-reloading/shot-groups

Scores shots: the ring value of a hole on a rule-book target face, the totals of ring series and practical stages, and the photo geometry and ellipse fits that place a target sheet. A refusal carries a typed issue and no text (`ShotGroupsError` with its `issue`, or `{ issue }` from the ring-mark fits), so the caller words it in its language. Its only dependency is `@open-reloading/units`. Private to this repository: it is not published.

```js
import { ringTotal, ShotGroupsError } from '@open-reloading/shot-groups'

ringTotal({ shots: [10.4, 10.2] }) // 20.6
try {
  ringTotal({})
} catch (e) {
  if (e instanceof ShotGroupsError) e.issue // { code: 'series-total', params: {} }
}
```

License: MIT
