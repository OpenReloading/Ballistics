# @rangefoundry/schema

The Zod schemas and TypeScript types of every OpenReloading record kind (cartridges, bullets, powders, loads, sessions and the rest), the stored unit of each quantity and its map to SI.

The JSON Schema of each record kind: `@rangefoundry/schema/json-schema/<name>.schema.json`.

```sh
npm install @rangefoundry/schema
```

```js
import { parseRef, toSi, units } from '@rangefoundry/schema'

console.log(units.pressure) // bar
console.log(toSi('pressure', 3800)) // 380000000
console.log(parseRef('catalogue:308-winchester')) // { scope: 'catalogue', id: '308-winchester' }
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/schema/

License: MIT
