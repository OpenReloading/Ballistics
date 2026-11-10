# @open-reloading/target-recognition

Finds shapes on target photos for the web app's hole detection and face search, without I/O: raster operations on working images held as flat arrays, row by row (`open`, `distanceSquared`, `components`, `insidePolygon`, `median1`, `upperMedian`), and a multi-scale blob detector (`space`, `peaksOf`, `sigmaAt`, `boxBlur`). Its dependencies are `@open-reloading/shot-groups` (for `Point`) and `@open-reloading/statistics`. Private to this repository: it is not published.

```js
import { peaksOf, radiiOf, space } from '@open-reloading/target-recognition'

// bright blobs about D px across on a gray image of w x h px, sigma 0.25 to 0.5 D, strongest first
const sp = space(gray, w, h, radiiOf(D, [0.25, 0.35, 0.5]))
const peaks = peaksOf(sp, new Uint8Array(w * h).fill(1), D) // [{ x, y, response, sigma }, ...]
```

License: MIT
