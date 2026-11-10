---

title: '@open-reloading/catalog'
sidebar_label: catalog
description: The catalogue records as one bundle and the checks they pass.
---

# `@open-reloading/catalog`

The catalogue records of this repository as one JSON bundle and the checks the records pass. The package reads no files. The code is MIT. Each record entry states its license in its `license` field; entries without one are CC BY 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project license (see `packages/catalog/LICENSE`). The [Data](../data/federations.md) pages describe the records and their sources.

## Install

```sh
npm install @open-reloading/catalog
```

It installs `@open-reloading/schema` with it. Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import                                 | Contents                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@open-reloading/catalog`              | The `Catalogue` interface, `checkRecords` (the cross-checks of a set of records), the coverage and plausibility checks |
| `@open-reloading/catalog/plausibility` | The plausibility checks alone                                                                                          |
| `@open-reloading/catalog/bundle.json`  | Every record, one array per kind (the `Bundle` type)                                                                   |

## Example

```js
import bundle from '@open-reloading/catalog/bundle.json' with { type: 'json' }
import { twistPlausible } from '@open-reloading/catalog/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
```

## Reading a records folder

The reader that validates a folder laid out as `packages/catalog/records/` into the bundle is repository tooling, not part of the package: `readRecords` of `tools/src/catalog/records.ts`, which `pnpm run data:validate` and the package build run. It reads the files and runs `checkRecords` on them. `errors` fail the validation. `warnings` are plausibility findings of published loads, which stay as printed and do not fail it.

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_catalog.html).
