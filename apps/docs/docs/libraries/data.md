---
title: '@open-reloading/data'
sidebar_label: data
description: The catalogue records as one bundle, their reader and plausibility checks.
---

# `@open-reloading/data`

The catalogue records of this repository as one JSON bundle, the reader that validates a records folder into that bundle, and the plausibility checks the records pass. The code is MIT. Each record entry states its licence in its `license` field; entries without one are CC BY 4.0, except data a maker published (a source with `origin` `manufacturer`), which carries no project licence (see `packages/data/LICENSE`). The [Data](../data/federations.md) pages describe the records and their sources.

## Install

```sh
npm install @open-reloading/data
```

It installs `@open-reloading/schema` with it. Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import | Contents |
|---|---|
| `@open-reloading/data` | `readRecords` and `readLoadTables` (Node, they read files), the coverage and plausibility checks |
| `@open-reloading/data/plausibility` | The plausibility checks alone, without file access |
| `@open-reloading/data/bundle.json` | Every record, one array per kind (the `Bundle` type) |

## Example

```js
import bundle from '@open-reloading/data/bundle.json' with { type: 'json' }
import { twistPlausible } from '@open-reloading/data/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
```

## Reading a records folder

`readRecords(root)` validates the records of a folder laid out as `packages/data/records/` of the repository, one directory per kind. Pass that folder of a clone, or several folders read as one set: the first must hold every kind directory, and the `load-tables.json` of every folder lists tables for checking fitted powders. The npm package ships no records folder: without `root`, `readRecords` reads the `records/` folder next to the package only in a repository checkout and throws in an installed package. For the records themselves, import `bundle.json`.

```js
import { readRecords } from '@open-reloading/data'

const { bundle, errors, warnings } = readRecords('Ballistics/packages/data/records')
```

`errors` fail the validation. `warnings` are plausibility findings of published loads, which stay as printed and do not fail it.

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_data.html).
