# @open-reloading/importers

Parsers that turn chronograph exports, pressure histories, spreadsheets and the OpenReloading JSON and CSV files into session candidates and records. They take text or a workbook the caller has read and do no I/O.

```sh
npm install @open-reloading/importers
```

```js
import { parseDelimited } from '@open-reloading/importers'

const result = parseDelimited('2800\n2810\n2795', { columns: { velocity: 1 }, velocityUnit: 'ft/s' })
console.log(result.session.strings[0].shots.map((shot) => shot.velocity.value)) // [ 853.44, 856.488, 851.916 ]
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/importers/

Licence: MIT
