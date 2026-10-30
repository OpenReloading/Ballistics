# @open-reloading/importers

Pure parsers, ESM: chronograph exports (text, or an XLSX or XLS workbook read from bytes) to `ChronoSession` candidates, tables of bullets, powders and cartridges to user records, and GRT and ChamberSim Reloaded load files to user records. No Node imports in `src/`. Package rules: root `AGENTS.md`.

## Commands (this directory, or `-w @open-reloading/importers` from the root)

- Build: `npm run build` (build `@open-reloading/schema` first)
- Test: `npm test` (Vitest). Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## Rules

- Formats: `chronoFormats` (`src/index.ts`) is the one list, in display order. `ChronoFormatId`, `detectFormat`, `detectWorkbookFormat`, `parseChrono` and the web format names derive from it, so a new format is its module plus one entry. Layouts and mappings: each parser and its tests.
- Detection and parsing read file content only, never the file name. `'delimited'` is never detected: it needs a column mapping.
- A parser returns only what the file supplies, plus `missingPaths`, the dot paths the user must enter. `test/complete.ts` fills exactly those paths and validates.
- Velocities are stored in m/s; `raw` keeps the cell text and unit as written. The caller's `velocityUnit` applies only where the file names none; a recognised file unit that differs throws.
- Throw on input the parser cannot read without guessing (a velocity like `2,800` that may hold a thousands separator, a missing unit). Warn, never throw, on a check that only compares (footer statistics, shots outside 30 to 2000 m/s).
- Workbook readers (`src/zip.ts`, `src/xml.ts`, `src/cfb.ts`, `src/xls.ts`) read untrusted bytes: every size, count and nesting bound is in `src/limits.ts` or beside its reader, checked before the work it bounds. Keep a bound when changing a reader; a new reader gets its own.
- Load file mappings change with `apps/docs/docs/data/grt-load-files.md`, table import with `apps/docs/docs/data/table-import.md`.
- `buildRecords` and the load file readers return plain records; the caller parses them with the user record schema (schema is types only here).

## Tests

- `test/fixtures.ts` holds synthetic files and `Workbook` objects, non-ASCII characters as `\u` escapes. `test/xlsx.ts` and `test/xls.ts` write test archives independently of the readers under test.
- Test files that use Node APIs start with `/// <reference types="node" />` (the package's `tsconfig.json` sets `"types": []`).
- Unverified layouts: a ShotView CSV or XLSX with a set bore flag, ShotView shots left out of the statistics, ShotView workbook footer labels in other languages.
