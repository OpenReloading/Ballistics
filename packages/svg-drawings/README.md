# @open-reloading/svg-drawings

Figure models of cartridge drawings, bullet outlines, the seating of a bullet in its chamber and target faces: lines, arcs, dimensions and labels that a renderer turns into SVG or canvas. No DOM, React or I/O; lengths in mm, angles in degrees.

```sh
npm install @open-reloading/svg-drawings
```

```js
import { lengthText } from '@open-reloading/svg-drawings'
import { revolutionVolume } from '@open-reloading/svg-drawings/bullet'

console.log(lengthText(25.4, 'in')) // 1.0000
console.log(revolutionVolume([[0, 0], [4, 0], [4, 10], [0, 10]], 10).toFixed(1)) // 502.7
```

Documentation: https://openreloading.github.io/Ballistics/docs/libraries/drawing/

License: MIT
