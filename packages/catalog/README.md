# @open-reloading/catalog

The OpenReloading catalogue records as one JSON bundle and the checks the records pass. The package reads no files.

```sh
npm install @open-reloading/catalog
```

```js
import bundle from '@open-reloading/catalog/bundle.json' with { type: 'json' }
import { twistPlausible } from '@open-reloading/catalog/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/catalog/

Licence: code MIT. Data records (`records/`): an entry with a `license` field uses that licence, an entry without one is CC BY 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project licence (see `LICENSE`).
