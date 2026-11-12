---

title: '@open-reloading/svg-drawings'
sidebar_label: drawing
description: Figure models of cartridges, bullets, seating and target faces, without a renderer.
---

# `@open-reloading/svg-drawings`

Figure models of cartridge drawings, bullet outlines, the seating of a bullet in its chamber and target faces: lines, arcs, dimensions and labels that a renderer turns into SVG or canvas. No DOM, React or I/O. Lengths are in mm and angles in degrees.

## Install

```sh
npm install @open-reloading/svg-drawings
```

Each library has its own [Semantic Versioning](../release.md#versions) version.

## Entry points

| Import                                   | Contents                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@open-reloading/svg-drawings`           | Shared geometry, layout, annotations and unit text                                                                                |
| `@open-reloading/svg-drawings/cartridge` | Cartridge figures from CIP and shotshell specifications                                                                           |
| `@open-reloading/svg-drawings/bullet`    | Bullet outlines, profiles and their volume, the density a record's mass and outline imply against its material (`outlineDensity`) |
| `@open-reloading/svg-drawings/seating`   | Seating a bullet: overall length, jump and intrusion                                                                              |
| `@open-reloading/svg-drawings/target`    | Target face figures                                                                                                               |

## Example

A length as inch text, and the volume in mm³ of a cylinder of 4 mm radius and 10 mm length from its half profile (radius, axial position):

```js
import { lengthText } from '@open-reloading/svg-drawings'
import { revolutionVolume } from '@open-reloading/svg-drawings/bullet'

console.log(lengthText(25.4, 'in')) // 1.0000
console.log(revolutionVolume([[0, 0], [4, 0], [4, 10], [0, 10]], 10).toFixed(1)) // 502.7
```

## Reference

Every export with its doc comment: [library reference](pathname:///library/modules/_open-reloading_svg-drawings.html).
