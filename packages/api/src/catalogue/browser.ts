/**
 * The browser-safe entry of the catalogue (`@open-reloading/api/catalogue`): the types, the build
 * from records and the opening of an index. It imports core and schema only and does no I/O; the
 * Node side that reads and writes the files is `node.ts`.
 */
export { buildCatalogue } from './build.ts'
export { openCatalogue } from './open.ts'
export * from './types.ts'
