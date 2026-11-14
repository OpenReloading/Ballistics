TypeScript packages in one pnpm workspace. The pages are generated from the doc comments of every export.

## Conventions

- One stored unit per quantity. The unit is part of the name or the doc comment.
- A record carries provenance wherever it has a source: the sources its values come from, with retrieval date and the license or terms they are used under.
- `svg-drawings` is pure functions, so it runs in a browser, in Node and on the server.
