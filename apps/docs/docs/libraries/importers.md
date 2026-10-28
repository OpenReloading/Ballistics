---
title: '@open-reloading/importers'
sidebar_label: importers
description: Parsers of chronograph exports, pressure histories and record tables.
---

# `@open-reloading/importers`

Parsers that turn chronograph exports, pressure histories, spreadsheets and the OpenReloading JSON and CSV files into session candidates and records. They take text or a workbook the caller has read, and do no I/O. The [table import](../data/table-import.md) page describes the table formats.

## Install

```sh
npm install @open-reloading/importers
```

It installs `@open-reloading/schema` with it. Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import | Contents |
|---|---|
| `@open-reloading/importers` | Format detection and every parser |

## Example

Three velocities in ft/s, one per line, read as a chronograph session in m/s:

```js
import { parseDelimited } from '@open-reloading/importers'

const result = parseDelimited('2800\n2810\n2795', { columns: { velocity: 1 }, velocityUnit: 'ft/s' })
console.log(result.session.strings[0].shots.map((shot) => shot.velocity.value)) // [ 853.44, 856.488, 851.916 ]
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_importers.html).
