TypeScript packages in one npm workspace. The pages are generated from the doc comments of every export.

## Conventions

- One stored unit per quantity. The unit is part of the name or the doc comment.
- Every record carries provenance: the sources its values come from, with retrieval date and the license or terms they are used under.
- `core` and `drawing` are pure functions, so they run in a browser, in Node and on the server.
