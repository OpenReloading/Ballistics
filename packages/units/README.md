# @rangefoundry/units

Quantity kinds, the stored unit of each, conversion to and from SI, and the parser that reads numbers typed with either decimal mark. No formatting and no runtime dependencies. Private to this repository: it is not published.

```js
import { fromSi, parseNumber, toSi } from '@rangefoundry/units'

toSi('length', 7.82) // 0.00782 (m)
fromSi('pressure', 3.8e8) // 3800 (bar)
parseNumber('1,5', '.') // { kind: 'number', value: 1.5, text: '1.5' }
```

License: MIT
