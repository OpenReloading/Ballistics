# @open-reloading/test-kit

Test helpers for the logic packages: tolerance matchers that work inside `toEqual`, seeded uniform and normal numbers, and fast-check arbitraries of the inputs the models take. A dev dependency of this repository's packages: it is not published.

```js
import { near, normals, probability } from '@open-reloading/test-kit'
import fc from 'fast-check'

expect({ v: 0.1 + 0.2 }).toEqual({ v: near(0.3, { absolute: 1e-15 }) })
normals(42, 1000) // the same 1000 standard normal numbers for seed 42
fc.assert(fc.property(probability(), (p) => p > 0 && p < 1))
```

License: MIT
