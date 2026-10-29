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
| `@open-reloading/schema/json-schema/*` | The JSON Schema (draft 2020-12) of each record kind and file, written from its Zod schema: `<name>.schema.json`, such as `bullet.schema.json` |

The JSON Schemas are part of the published contract: a change to them follows the [versioning rules](../release.md#versions) of the package.

## Example

```js
import { parseRef, toSi, units } from '@open-reloading/schema'

console.log(units.pressure) // bar
console.log(toSi('pressure', 3800)) // 380000000
console.log(parseRef('catalogue:308-winchester')) // { scope: 'catalogue', id: '308-winchester' }

const bullet = await import('@open-reloading/schema/json-schema/bullet.schema.json', {
  with: { type: 'json' },
})
console.log(bullet.default.$schema) // https://json-schema.org/draft/2020-12/schema
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_schema.html).
