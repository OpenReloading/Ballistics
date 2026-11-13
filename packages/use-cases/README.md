# @rangefoundry/use-cases

Runs the computations the web app, the command line and the API offer, without a framework or I/O: a request is checked against its zod schema, run, and answered with a status, the results, their units and the advisories (`interiorBody` and `runInterior`, `chargeBody` and `runChargeTarget`, `trajectoryBody` and `runTrajectory`, and so on for truing, range strings and stability; `simulate` and `simulateQuery` for a load file); `operations` lists them with their schemas, examples and texts, the list the API's routes, its contract document and the command line read. A run's solver work is a compute task: it runs in this thread (`runTask`) or in a worker of the caller, across which an error travels as a plain object (`serializeError`, `reviveError`). The advisory texts are a subpath of their own, `@rangefoundry/use-cases/advisories`, for a bundle that needs the words without the schemas. The browser-safe catalogue (build an index from records, open it, list and get) is the subpath `@rangefoundry/use-cases/catalog`. A run reads a named record through a lookup in its context (`findBullet`, `findCartridge`); the package's lookups (`findBullet`, `findCartridge`, `findPowder`) read the `Catalogue` interface of `@open-reloading/catalog`, and a caller may pass any other. Its dependencies are `@rangefoundry/ballistics`, `@open-reloading/catalog`, `@open-reloading/schema`, `@rangefoundry/statistics` and zod. Private to this repository: it is not published.

```js
import { reviveError, runTask, serializeError } from '@rangefoundry/use-cases'

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
