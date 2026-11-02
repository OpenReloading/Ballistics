/**
 * The browser-safe entry of the catalogue (`@open-reloading/api/catalogue`): the types, the build
 * from records and the opening of an index. No I/O; `node.ts` reads and writes the files.
 */
export { buildCatalogue } from './build.ts'
export { openCatalogue } from './open.ts'
export * from './types.ts'
