---
title: '@open-reloading/drawing'
sidebar_label: drawing
description: Figure models of cartridges, bullets, seating and target faces, without a renderer.
---

# `@open-reloading/drawing`

Figure models of cartridge drawings, bullet outlines, the seating of a bullet in its chamber and target faces: lines, arcs, dimensions and labels that a renderer turns into SVG or canvas. No DOM, React or I/O. Lengths are in mm and angles in degrees.

## Install

```sh
npm install @open-reloading/drawing
```

Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import | Contents |
|---|---|
| `@open-reloading/drawing` | Shared geometry, layout, annotations and unit text |
| `@open-reloading/drawing/cartridge` | Cartridge figures from CIP and shotshell specifications |
| `@open-reloading/drawing/bullet` | Bullet outlines, profiles and their volume |
| `@open-reloading/drawing/seating` | Seating a bullet: overall length, jump and intrusion |
| `@open-reloading/drawing/target` | Target face figures |

## Example

A length as inch text, and the volume in mm³ of a cylinder of 4 mm radius and 10 mm length from its half profile (radius, axial position):

```js
import { lengthText } from '@open-reloading/drawing'
import { revolutionVolume } from '@open-reloading/drawing/bullet'

console.log(lengthText(25.4, 'in')) // 1.0000
console.log(revolutionVolume([[0, 0], [4, 0], [4, 10], [0, 10]], 10).toFixed(1)) // 502.7
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_drawing.html).
