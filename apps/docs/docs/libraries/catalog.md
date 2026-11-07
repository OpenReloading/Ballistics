---

title: '@open-reloading/catalog'
sidebar_label: catalog
description: The catalogue records as one bundle, their reader and plausibility checks.
---

# `@open-reloading/catalog`

The catalogue records of this repository as one JSON bundle, the reader that validates a records folder into that bundle, and the plausibility checks the records pass. The code is MIT. Each record entry states its licence in its `license` field; entries without one are CC BY 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project licence (see `packages/catalog/LICENSE`). The [Data](../data/federations.md) pages describe the records and their sources.

## Install

```sh
npm install @open-reloading/catalog
```

It installs `@open-reloading/schema` with it. Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import                                 | Contents                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@open-reloading/catalog`              | `readRecords` and `readLoadTables` (Node, they read files), the coverage and plausibility checks |
| `@open-reloading/catalog/plausibility` | The plausibility checks alone, without file access                                               |
| `@open-reloading/catalog/bundle.json`  | Every record, one array per kind (the `Bundle` type)                                             |

## Example

```js
import bundle from '@open-reloading/catalog/bundle.json' with { type: 'json' }
import { twistPlausible } from '@open-reloading/catalog/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
```

## Reading a records folder

`readRecords(root)` validates the records of a folder laid out as `packages/catalog/records/` of the repository, one directory per kind. Pass that folder of a clone, or several folders read as one set: the first must hold every kind directory, and the `load-tables.json` of every folder lists tables for checking fitted powders. The npm package ships no records folder: without `root`, `readRecords` reads the `records/` folder next to the package only in a repository checkout and throws in an installed package. For the records themselves, import `bundle.json`.

```js
import { readRecords } from '@open-reloading/catalog'

const { bundle, errors, warnings } = readRecords('Ballistics/packages/catalog/records')
```

`errors` fail the validation. `warnings` are plausibility findings of published loads, which stay as printed and do not fail it.

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_catalog.html).
