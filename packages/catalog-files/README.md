# @rangefoundry/catalog-files

Reads folders of catalogue record files, laid out as `packages/catalog/records/` of the repository, into the bundle of `@rangefoundry/catalog`, and reports what fails its checks. It runs on Node and reads the folders it is given.

```js
import { readRecords } from '@rangefoundry/catalog-files'

const { bundle, errors, warnings } = readRecords(['records', 'my-records'])
```

- `readRecords(roots)`: one root, or several read as one set (the first holds every kind directory). `errors` lists each file and field that fails a check, `warnings` the plausibility findings of published loads, which do not fail it.
- `validateRecords(roots)`: `readRecords` plus the maker-source rule of the public catalog as errors.
- `readPublishedLoads` and `readLoadTables`: the published load files and the `load-tables.json` of a root.

License: AGPL-3.0-only
