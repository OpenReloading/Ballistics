# @open-reloading/use-cases

Runs the computations the web app, the command line and the API offer, without a framework or I/O: a request is checked against its zod schema, run, and answered with a status, the results, their units and the advisories (`interiorBody` and `runInterior`, `chargeBody` and `runChargeTarget`, `trajectoryBody` and `runTrajectory`, and so on for truing, range strings and stability). A run's solver work is a compute task: it runs in this thread (`runTask`) or in a worker of the caller, across which an error travels as a plain object (`serializeError`, `reviveError`). The advisory texts are a subpath of their own, `@open-reloading/use-cases/advisories`, for a bundle that needs the words without the schemas. A run that names a record reads it through the `Catalogue` interface of `@open-reloading/catalog`. Its dependencies are `@open-reloading/ballistics`, `@open-reloading/catalog`, `@open-reloading/schema`, `@open-reloading/statistics` and zod. Private to this repository: it is not published.

```js
import { reviveError, runTask, serializeError } from '@open-reloading/use-cases'

// in a worker
try {
  postMessage({ succeeded: true, value: runTask(task) })
} catch (error) {
  postMessage({ succeeded: false, error: serializeError(error) })
}
// in the caller: a failed task rejects with the rebuilt TruingError, InputError or Error
reviveError(message.error)
```

License: MIT
