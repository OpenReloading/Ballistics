---
title: '@open-reloading/data'
sidebar_label: data
description: The catalogue records as one bundle, their reader and plausibility checks.
---

# `@open-reloading/data`

The catalogue records of this repository as one JSON bundle, the reader that validates a records folder into that bundle, and the plausibility checks the records pass. The records are licensed CC BY 4.0, the code MIT. The [Data](../data/federations.md) pages describe the records and their sources.

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

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_data.html).
