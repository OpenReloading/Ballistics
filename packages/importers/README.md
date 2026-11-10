# @open-reloading/importers

Parsers that turn chronograph exports, pressure histories, spreadsheets, load files and the OpenReloading JSON and CSV files into candidates: a session, or a record without the id and save time the caller gives it (`id` is `idOfKey(key)`). The table and load-file readers report a skipped cell or field as a code with its values (`{ code, params }`) for the caller to word. They take text or a workbook the caller has read and do no I/O.

```sh
npm install @open-reloading/importers
```

```js
import { parseDelimited } from '@open-reloading/importers'

const result = parseDelimited('2800\n2810\n2795', { columns: { velocity: 1 }, velocityUnit: 'ft/s' })
console.log(result.session.strings[0].shots.map((shot) => shot.velocity.value)) // [ 853.44, 856.488, 851.916 ]
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/importers/

License: MIT
