# @rangefoundry/statistics

The statistics the ballistics models share: chi-square, F and Student t distributions, velocity statistics with the interval of the standard deviation, least squares on log parameters with the identifiability of each, the Huber loss, bisection, and a seeded random generator. An input it refuses throws `InputError` with a typed issue `{ code, params }` (`StatisticsIssue`) and no text, so the caller words it in its language. No runtime dependencies. Private to this repository: it is not published.

```js
import { chiSquareQuantile, seededUniforms, velocityStatistics } from '@rangefoundry/statistics'

chiSquareQuantile(0.975, 4) // 11.143...
velocityStatistics([812, 815, 809, 818])?.standardDeviation // 3.87... (m/s)
seededUniforms(42)() // the same number in [0, 1) for the same seed
```

License: MIT
