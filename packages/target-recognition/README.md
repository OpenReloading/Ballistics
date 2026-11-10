# @open-reloading/target-recognition

Proposes the bullet holes on a target photo for the web app's hole detection, without I/O. Callers go through the inference port, `holeDetector.propose`, which takes an RGBA image buffer and resolves to hole proposals in image px. Its dependencies are `@open-reloading/shot-groups` (for `Point`) and `@open-reloading/statistics`. Private to this repository: it is not published.

- `holeDetector`: the classical detector, known-weak. It misses the default bar on the holdout photos and stays until a learned model meets an accuracy bar that is not measured yet ([Quality bar](../../apps/docs/docs/models/hole-detection.md#quality-bar)).
- The detector's parts, also used by the web app's face search, photo quality and bullet photo: raster operations on working images held as flat arrays, row by row (`open`, `distanceSquared`, `components`, `insidePolygon`, `median1`, `upperMedian`), a multi-scale blob detector (`space`, `peaksOf`, `sigmaAt`, `boxBlur`) and Otsu's threshold (`otsu`).

```js
import { holeDetector } from '@open-reloading/target-recognition'

// image: { width, height, data } as in a canvas ImageData; 8 px/mm, 7.62 mm bullets
const { proposals } = await holeDetector.propose({ image, pxPerM: 8000, expectedHoleDiameter: 0.00762, auto: true })
// proposals: [{ x, y, confidence, clusterSize, clusterId, diameter }, ...], most confident first
```

License: MIT
