# @open-reloading/use-cases

Runs the computations the web app, the command line and the API offer, without a framework or I/O: a compute task goes in, the result of the ballistics function of its kind comes out. A task runs in this thread (`runTask`) or in a worker of the caller, across which an error travels as a plain object (`serializeError`, `reviveError`). Its dependencies are `@open-reloading/ballistics` and `@open-reloading/statistics`. Private to this repository: it is not published.

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
