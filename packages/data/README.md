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

`readRecords(root)` validates a records folder: pass `root`, the `packages/data/records/` folder of a repository clone. The package ships no records folder, so without `root` it throws.

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/data/

Licence: code MIT. Data records (`records/`): each entry states its licence in its `license` field; entries without one are CC BY 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project licence (see `LICENSE`).
