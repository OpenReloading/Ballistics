# @open-reloading/importers

Parsers for chronograph export files, ESM. Pure functions from file text, or from an XLSX workbook read from file bytes, to `ChronoSession` candidates, and tables of bullets, powders and cartridges to user records. No Node imports in `src/`. Package rules: root `AGENTS.md`.

## Commands (this directory, or `-w @open-reloading/importers` from the root)

- Build: `npm run build` (output `dist/`, build `@open-reloading/schema` first)
- Test: `npm test` (Vitest)
- Single test: `npx vitest run <file> -t "<name>"`
- Type check: `npm run typecheck`

## API (`src/index.ts`)

- Layouts and the mapping to `ChronoSession`: each parser in `src/` and its tests.
- `detectFormat(text)` returns `'openreloading-json'`, `'shotview-csv'`, `'openreloading-csv'` or `null`, tested in that order.
  - `'delimited'` is never detected: it needs a column mapping.
  - Detection and parsing read file content only, never the file name.
- `chronoFormats` (`readonly ChronoFormat[]`): one entry per format (`id`, `name` shown to users, `reads` text or workbook, `detect`, `parse`) in display order.
  - Detection walks the list.
  - `ChronoFormatId` (the type of the list's ids), `detectFormat`, `detectWorkbookFormat`, `parseChrono` and the web format names come from it, so a new format is its module plus one entry.
- `detectWorkbookFormat(book)` returns, from cells only, `'shotview-xlsx'` (a row starting `#` with a bracketed unit in the second cell) or `null`.
- `decodeText(bytes)`: UTF-16 LE after FF FE, UTF-16 BE after FE FF, else UTF-8, all strict (`TextDecoder` with `fatal`). An odd byte count after a UTF-16 mark throws `UTF-16 text with an odd number of bytes`, other failures `the file is not UTF-8 or UTF-16 text; ...`. A UTF-8 byte order mark stays as U+FEFF.
- `parseChrono(input, options, format?)` takes text or a `Workbook`, detects the format when not named (null when none matches) and calls its parser.
  - `date` goes to the workbook formats, `device` to the template and `delimited`, `columns`, `delimiter` and `skipRows` to `delimited` only.
  - The web app's chronograph import (`apps/web/src/lib/chrono.ts`) uses `decodeText` and `parseChrono`.
- `parseShotView`, `parseOpenReloadingCsv` and `parseDelimited` take the file as text (the caller turns bytes into text) and options `velocityUnit`, `fileName`, `sha256` (the caller computes the hash, stored lowercase, 64 hex digits).
- Each parser returns `{ format, session, stringLabels, velocityUnits, missingPaths, warnings }`:
  - `velocityUnits`: distinct `{ unit, source: 'file' | 'caller' }` in first-seen order, computed by `buildChronoImport` (`src/result.ts`) from each shot's `raw`, which ends in the file's unit text whenever the file names one.
  - `session` holds only what the file supplies. `stringLabels`: one label per string (ShotView session name, the `string` column of the template and of delimited text).
  - `missingPaths`: the dot paths the user should enter. The ones a catalogue session (`catalogueSession.parse`) requires and a user session does not: always `id`, `device.manufacturer`, `conditions.airTemperature`, `strings.<i>.load`, and `date`, `device.model` and `provenance.sources.0.title` when unknown. Plus `device.firmware` and, for `optical` devices without a distance, `muzzleDistance`, which the schema treats as optional. Always `device.manufacturer`: a catalogue reference no parser can supply, the caller resolves it from `SessionCandidate.device.manufacturerName` where the file gave a name. `test/complete.ts` fills exactly those paths and validates.
- `splitDelimited(line, delimiter)` in `src/text.ts`: tabs before a cell are skipped only when the delimiter is not a tab. Text between a closing quote and the delimiter is kept in the cell (`"812" 5` reads `812 5`).
- `parseVelocityUnit` (`src/units.ts`) and `formatMinutes` (`src/text.ts`) are exported by `src/index.ts`. `checkSha256` (`src/result.ts`) checks the `sha256` option of every parser.
- Line ends: LF, CRLF, CR.

## Velocities

- `velocityUnit` applies only when the file's unit is missing or unknown. In every parser that reads a unit, a recognised unit the file names that differs from `velocityUnit` throws `velocity unit "<text>" (<unit>) in the file differs from <unit> named by the caller` (`checkCallerUnit` in `src/units.ts`).
- Unit text accepted (`parseVelocityUnit`): `fps`, `ft/s`, `mps`, `m/s`, `kph`, `km/h`, `mph` (any case, km/h and mph spellings unverified).
- Parsers also throw on a wrong shape, a file without shots, a velocity that is not a number (including a lone comma before exactly three digits, such as `2,800`, which may be a thousands separator), a velocity of zero or less, a malformed `sha256`, and a velocity unit that is missing or unknown unless `velocityUnit` names one.
- Velocities stored in m/s (ft/s times 0.3048, km/h divided by 3.6, mph times 0.44704, rounded to 1e-6 m/s). `raw` keeps the cell text and the unit as written in the file. When `velocityUnit` was used, `buildChronoImport` sets the provenance source `note` to the unit the user named.
- `buildChronoImport` warns once per string about shots outside 30 to 2000 m/s (an assumed small-arms range, not a cited bound), to catch a wrong unit, a wrong column or statistics rows read as shots.

## Workbook readers

- XLSX (`src/zip.ts`, `src/xml.ts`, `src/cells.ts`, `src/workbook.ts`, size bounds in `src/limits.ts`): `readWorkbook(bytes, { inflate? })` is the only async function and returns `{ worksheets: { name, rows: string[][] }[] }`. `isWorkbook(bytes)` tells ZIP and legacy Excel (OLE2) bytes.
- ZIP (read from the central directory):
  - Stored and deflate entries only. Refused: split, ZIP64 and encrypted archives, other methods for needed parts, repeated names (also in another case) and data outside the file.
  - Only the relationships, workbook, shared strings and worksheet parts are read, each worksheet part at most once (a repeated relationship id or a second `sheet` naming a part already read is refused), each checked against its declared size and CRC-32.
  - Limits (assumed bounds): 8 MiB per part, 1 MiB for the package relationships, workbook relationships and workbook parts (read as element trees) and 32 MiB in total on the declared sizes before inflating. Inflation stops past the declared size. A deflated part whose compressed size exceeds the declared size plus one eighth of it plus 65536 bytes is refused before copying. Inflating uses `DecompressionStream('deflate-raw')` unless `inflate` is given.
- XML:
  - Parts must be UTF-8 (read with `Response.text()`, U+FFFD refused). No DOCTYPE, only the five predefined entities and character references to XML characters, nesting at most 32, at most 256 attributes per element. Names compared without namespace prefix.
  - `scanXml(text, events, left?)` reads in one pass with callbacks (`open`, `text`, `close`, each with the local names of the enclosing elements). `parseXml(text, left?)` builds a tree on it. The shared strings and worksheet parts are read in one pass without a tree: rows only from the first `sheetData`, cells only as `c` children of its rows, the first `v`, the first `is`. Each cell placed by `placeCell` from `src/cells.ts` when it closes.
  - `left` counts down a budget shared by all parts of a workbook, 4000000 elements and 67108864 characters of text and attribute markup (`maxElements`, `maxXmlCharacters`). It throws `more elements than allowed` or `more characters than allowed` before building past it. `readWorkbook` reports `the XML parts hold more than <n> elements` or `... characters of text and attribute markup`.
- Cells:
  - Placed by their `r` reference up to column 256, gaps as empty text, rows without cells left out. At most 1000000 cells (gaps included) and 33554432 characters of cell text (a shared string counted at every cell that refers to it) per workbook (assumed bounds).
  - Shared and inline strings: rich-text runs joined, phonetic runs left out. Shared strings trimmed and U+FEFF removed once. Boolean `0` as empty text. Every other cell: the `v` text as written (no styles, formats or formulas).
- Legacy `.xls` (`src/cfb.ts`, `src/xls.ts`, bytes starting `D0 CF 11 E0 A1 B1 1A E1`):
  - A compound file, version 3 or 4, read through its FAT, DIFAT and mini stream. Loops, short chains and sectors outside the file refused, the `Workbook` stream limited to 8 MiB.
  - BIFF8 records only (other versions, FilePass and an `EncryptedPackage` refused). Worksheets from BoundSheet8 type 0 in workbook order. Cells from LabelSst, Label, Number, RK, MulRk, BoolErr, Blank, MulBlank and Formula cached values (numbers as `String(x)`, FALSE empty, TRUE `1`, error codes as their text). Nested chart substreams left out, strings across Continue records, cells placed and counted by `placeCell` as in XLSX.
  - It returns the same `Workbook`, so a ShotView `.xls` imports as `shotview-xlsx`.

## Formats

- Workbooks: `parseShotViewWorkbook` takes a `Workbook` and `WorkbookOptions` (`ChronoParserOptions` plus `date`).
  - One session per workbook, one string per worksheet with a header row (others skipped with a warning naming the position). Shots end at the first row whose first cell is neither empty nor a whole number. Warnings per worksheet start `worksheet <n>: `.
  - The `date` option keeps one day and the worksheets without a date, and is the session date. Refused when no worksheet has the day (dates listed ascending). A worksheet without a date warns `worksheet <n>: no date read; <date> taken from the date option` instead of asking for the date, except when no worksheet has a date at all, which adds no date warning. Without it, the session date is set when every read string has the same date.
  - The header unit is the text from the first `(` to the last `)` (`bracketed` in `src/text.ts`, linear time). A footer or summary value that is not a number warns `is not a number; not checked`.
  - ShotView: rows core shared with the CSV parser (`readShotRows` in `src/shot-rows.ts`). Label: the first cell above the header, else the worksheet name. Date from the footer row labelled `DATE` or `DATUM`. Footer statistics checked as in the CSV.
- OpenReloading session JSON (`src/openreloading-json.ts`, the first format, the one the session summary exports): `{ format: 'openreloading-session', version: 1, date?, device?: { kind, manufacturerName?, model? }, muzzleDistance? (m), note?, strings: [{ label?, shots: [{ velocity (m/s), coldBore?, excluded? }] }] }`.
  - `isOpenReloadingJson` tests the `format` member. `parseOpenReloadingJson` validates by hand and throws with the member path. `stringifyOpenReloadingJson(import)` writes it and reads back to the same strings and labels.
  - No unit is needed. `velocityUnit` is ignored.
- ShotView CSV:
  - U+FEFF and NUL removed wherever they appear. Decimal comma or point per cell. Rows after the header are joined where a quoted cell spans a line break. The first `-` row ends the shots.
  - CLEAN BORE and COLD BORE read by position (columns 7 and 8). Empty, `0`, `no`, `false` and `n` (any case, trimmed) are unset, other text is set, also in workbooks. Either sets `coldBore`, and the flag goes to `session.note`.
  - The footer date (row after the last `-` row) is read with English or German month names, otherwise `date` is missing with a warning. Footer average, population standard deviation and spread are compared with the shots (tolerance 0.2 in the file's unit) and only produce warnings.
- Generic importer (`src/generic.ts`): `parseDelimited(text, { columns, delimiter?, skipRows?, device?, ... })`, columns by number (from 1) or header text (case-insensitive).
  - Delimiter, when not given: with header-text columns the first of tab, `;`, `,` under which the header row is found and splits into cells. Else the first that splits every non-empty line outside quoted cells, else the first that splits any line, else one column. Without a header and with a detected `,`, a row whose velocity cell and next cell read as one number (`812,5`, `2,800.0`) or whose previous cell and velocity cell do (`2,800`) throws.
  - With a header row and a detected `,`, an integer velocity followed by 1 to 3 digits in an unmapped column (`812,5`, `2800,1`) adds one warning naming the rows and is read as two columns. Mapped columns and the cell before the velocity are not checked. `2800,2600` reads as two columns without a warning.
  - A row with more cells than the header throws, naming the unquoted-comma cause when the comma was detected. Headerless rows with different counts throw. `skipRows` must be a whole number and is refused with a header-text column.
  - Unit per row from a recognised `velocityUnit` cell, else the token of a header-text velocity column (recognised bracketed text, else a recognised last word), else a non-empty `velocityUnit` cell, else the `velocityUnit` option. A `velocityUnit` cell naming another recognised unit than the token throws.
  - Empty velocity skipped with a warning. Consecutive equal `string` labels form one string. `coldBore` accepts `1 x yes true` and `0 no false` or empty. Any other `excluded` text is the reason. Default device kind `other` without manufacturer name or model.
- `parsePressureHistory(text, { sensor, pressureUnit?, timeUnit?, columns?, delimiter?, lowPass? })` (`src/pressure-history.ts`): a pressure-time trace for `fitPressureCurve` of core (no dependency on it). Times in s, `pressureBar` in bar.
  - Units from the header (text in `(...)` or `[...]`, else a recognised last word) or the options. A missing unit throws `pressure unit is missing: ...` (time likewise), a file unit that differs from the option throws. The sensor position (`breech`, `mean`, `base`) is always the caller's.
  - Throws on a non-number (`line <n>: ...`), times that do not increase and fewer than 3 samples. `lowPass: { cutoff }` is a zero-phase one-pole filter.
- `parseOpenReloadingCsv`: first row of names from `string velocity velocityUnit coldBore excluded` (any case, trailing empty cells ignored, `velocity` required), delimiter from that row.

## Tables to user records

- `readTable(text)` (`src/tables.ts`): a JSON list of objects, or delimited text (`,`, `;`, tab) whose first row has two cells or more and repeats its width in a second row. Else `{ refusal }` ("no table", JSON that does not parse or has another shape). `tableOfRows(rows)` takes worksheet rows. A table without data rows is refused.
- `suggestKind(table)` (`src/records.ts`): a score per kind (bullet, powder, cartridge) from header words and value ranges. `tierFloors`: high from 0.80, medium from 0.60, low from 0.40; below, `refusal` names the scores and the floor.
- `autoMap(table, kind)`: per column the field (by header alias, `fieldSpecs` in `src/record-fields.ts`), the unit (from the header, else the values, else the stored unit) and the decimal mark.
- `buildRecords(table, kind, map, now)`: each row checked on its own. `counts` (accepted, with a warning, rejected), `rejected` and `warnings` with row, column, cell and reason. Makers become manufacturer records. Ids from `idOfKey` of kind, name, maker and, for bullets, diameter and mass. The caller parses each record with the user record schema (schema is types only here).

## Unverified and tests

- Unverified layouts: a ShotView CSV with a set bore flag, ShotView shots left out of the statistics, an XLSX workbook with a set bore flag, ShotView workbook footer labels in other languages.
- `test/fixtures.ts` holds synthetic files and `Workbook` objects. Non-ASCII characters are written as `\u` escapes. `test/xlsx.ts` writes test archives with `node:zlib` and `test/xls.ts` writes BIFF8 compound files with `Buffer`, both independent of the readers under test.
- Test files that use Node APIs start with `/// <reference types="node" />` (the package's `tsconfig.json` sets `"types": []`).
