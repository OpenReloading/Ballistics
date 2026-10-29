# @open-reloading/data

The OpenReloading catalogue records as one JSON bundle, the reader that validates a records folder into that bundle, and the plausibility checks the records pass.

```sh
npm install @open-reloading/data
```

```js
import bundle from '@open-reloading/data/bundle.json' with { type: 'json' }
import { twistPlausible } from '@open-reloading/data/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/data/

Licence: the records CC BY 4.0, the code MIT
