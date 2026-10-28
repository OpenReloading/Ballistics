---
title: '@open-reloading/schema'
sidebar_label: schema
description: Zod schemas, types and stored units of every record kind.
---

# `@open-reloading/schema`

The Zod schemas and TypeScript types of every record kind (cartridges, bullets, powders, loads, sessions and the rest), the stored unit of each quantity and its map to SI, and the reference format `catalogue:<record id>` or `user:<UUID>`. The [record model](../data/record-model.md) describes the records.

## Install

```sh
npm install @open-reloading/schema
```

Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import | Contents |
|---|---|
| `@open-reloading/schema` | Every schema, type and unit helper |

## Example

```js
import { parseRef, toSi, units } from '@open-reloading/schema'

console.log(units.pressure) // bar
console.log(toSi('pressure', 3800)) // 380000000
console.log(parseRef('catalogue:308-winchester')) // { scope: 'catalogue', id: '308-winchester' }
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_schema.html).
