# @open-reloading/test-kit

Test helpers for the logic packages: a tolerance matcher that works inside `toEqual`, and fast-check arbitraries of the inputs the models take. A dev dependency of this repository's packages: it is not published.

```js
import { near, probability } from '@open-reloading/test-kit'
import { assert, property } from 'fast-check'

expect({ v: 0.1 + 0.2 }).toEqual({ v: near(0.3, { absolute: 1e-15 }) })
assert(property(probability(), (p) => p > 0 && p < 1))
```

License: MIT
