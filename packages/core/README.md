# @open-reloading/core

The OpenReloading models as pure functions without I/O: interior ballistics, the charge solver, the atmosphere, drag and trajectory, stability, truing, group and velocity statistics. Results are simulations, not load data.

```sh
npm install @open-reloading/core
```

```js
import { airDensity, speedOfSound, standardAtmosphere } from '@open-reloading/core'

const air = standardAtmosphere(0)
console.log(speedOfSound(air).toFixed(1)) // 340.3
console.log(airDensity(air).toFixed(3)) // 1.225
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/core/

Licence: MIT
