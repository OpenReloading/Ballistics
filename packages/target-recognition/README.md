# @open-reloading/target-recognition

Finds the target face and proposes the bullet holes on a target photo for the web app, without I/O. Callers get hole proposals through the inference port, `holeDetector.propose`, which takes an RGBA image buffer and resolves to proposals in image px. Its dependencies are `@rangefoundry/shot-groups` (points, ellipse fitting and plane geometry) and `@rangefoundry/statistics`. Private to this repository: it is not published.

- `holeDetector`: the classical detector, known-weak. It misses the default bar on the holdout photos and stays until a learned model meets an accuracy bar that is not measured yet ([Quality bar](../../apps/docs/docs/models/hole-detection.md#quality-bar)).
- The face search: `findFace` finds which face of a list is on the photo and how it lies, `fitPicked` and `fitDiameter` fit a face the user picks, `onPhoto` maps a search to the full photo, `faceLabel` gives the detector the face's print. A face is any object with the fields of `PrintedFace`, such as a target face record.
- Helpers the web app's photo quality check and bullet photo use: `grayGrid`, `shareInside`, `clamp`, `components`, `median1` and Otsu's threshold `otsu`.

```js
import { holeDetector } from '@open-reloading/target-recognition'

// image: { width, height, data } as in a canvas ImageData; 8 px/mm, 7.62 mm bullets
const { proposals } = await holeDetector.propose({ image, pxPerM: 8000, expectedHoleDiameter: 0.00762, auto: true })
// proposals: [{ x, y, confidence, clusterSize, clusterId, diameter }, ...], most confident first
```

License: MIT
