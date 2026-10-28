---
title: '@open-reloading/core'
sidebar_label: core
description: The interior and exterior models, group statistics and solvers, as pure functions.
---

# `@open-reloading/core`

The models of this site as pure functions without I/O: interior ballistics, the charge solver, the atmosphere, drag and trajectory, stability, truing, group and velocity statistics. They run in a browser, in Node and on a server. Each [model page](../models/interior-m3.md) names the functions it documents. Results are simulations, not load data.

## Install

```sh
npm install @open-reloading/core
```

Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import | Contents |
|---|---|
| `@open-reloading/core` | Every model, solver and statistic |

## Example

The ICAO standard atmosphere at sea level, its speed of sound in m/s and air density in kg/m³:

```js
import { airDensity, speedOfSound, standardAtmosphere } from '@open-reloading/core'

const air = standardAtmosphere(0)
console.log(speedOfSound(air).toFixed(1)) // 340.3
console.log(airDensity(air).toFixed(3)) // 1.225
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_core.html).
