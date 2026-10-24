---
title: Catalogue storage
description: Why the read-only catalogue needs no server database, the single search matcher and sort order every edition uses, and the fallback if the decision's triggers fire.
---

# Catalogue storage

The catalogue (the records of `packages/data`) is read only, rebuilt from git on every build and small: about 1.2 thousand records in the public data. This page records how it is stored and queried, what was measured, and which part is already in code: the one search matcher and the one sort order in `packages/schema` (`src/search.ts`, `src/order.ts`) and the in-process catalogue module in `packages/api` (`src/catalogue/`), which the API's routes and compute lookups read. Paths are relative to the repository root. The steps D0 to D6 of the epic "Data model: one entity per concept" carry the rest out.

## Decision

No server database for the catalogue. A typed index and a record file are built at build time and opened in process through one `Catalogue` interface, used by the API server, the Pages build, the browser and the tests. User data stays in the browser (`apps/docs/docs/data/record-model.md`).

What decides it is not speed, since every option answers in under 3 ms at this size, but:

1. **Parity.** One implementation of list, filter, search, ranking and order runs in Node and in the browser. The server answers `q` with SQL `ilike` (`packages/api/src/db/queries.ts`, `component-queries.ts`), the Pages edition with a lower-case `includes` over `search.json` (`apps/web/src/lib/static-api.ts`) and the web lists with `matchesQuery` (`apps/web/src/lib/lists.ts`): three matchers that disagree. `matchesQuery` now calls the schema's matcher and so does the API (through the catalogue); the static edition's `search.json` matcher moves over in a later step, and the bullet list's own word-start rule (`bulletMatches`) stays until the record pickers use the ranker.
2. **Three defects a database does not fix.** The JIT cost of PostgreSQL at default settings, two sort orders between the editions, and word-order dependent search.
3. **Deletion.** The SQL layer (`packages/api/src/db/`), the PGlite path of the static build, the seed lock, the `db` service of `compose.yaml` and the database packages go away.

Measured on the public bundle, one machine, medians:

| | PostgreSQL 18 | PGlite | In-process index |
|---|---|---|---|
| Ready from nothing | 1.35 s container start, then 0.7 s seed | 0.7 to 3.1 s | 2 to 3 ms from the prebuilt files |
| Memory beyond Node | 89 MB idle container | 560 MB or more | +6 MB |
| 200-row cartridge page | 520 ms with JIT on, 32 ms with `jit=off` | 58 ms | 0.003 ms |
| In the browser | no | yes, +3.7 MB brotli | yes, plain JavaScript |

Ranked search over a generated 20,000 bullet index in plain JavaScript takes 1 to 2.5 ms per query. A scan with a trigram or full text index is needed only above a few thousand rows in a SQL engine; the in-process index needs none.

## The module

`packages/api/src/catalogue/`. The routes, the compute record lookups, the server and the static build read it. The SQL layer next to it (`packages/api/src/db/`) answers nothing and stays only for the parity tests until it is removed:

- `derive.ts`: one index row per record, `{ item, sortKey, search }`. `item` is the list item the route answers today (the cartridge's sheet minima and case head, a bullet's first G1 and G7 coefficient, a target face's caliber classes), `sortKey` and `search` come from the schema package's `sortKey` and `searchKey`. Also the revision: a synchronous 53-bit hash of the record's JSON text, the same in Node and the browser, for change detection only.
- `build.ts`: `buildCatalogue(records)` returns the typed index (`CatalogueIndex`, every list in its default order, format 1) and the record file (every record by id, one map per kind). Pure, so the build, the tests and a browser can all run it. The files hold the records as they are: `kind`, `origin` and `revision` are added when a record is read.
- `open.ts`: `openCatalogue({ index, records })` returns the `Catalogue` interface: `cartridges`, `powders`, `bullets` (with `q`, `table`, `manufacturer`, `cartridge`, `limit`, `offset`), `manufacturers`, `targetFaces`, `federations`, `disciplines`, `targetMappings`, `capacities` and `get(kind, id)`. The record file may be a function, read on the first `get`. An index of another format is rejected.
- `list.ts`: the one filter, rank and page step. A query ranks by `score` and keeps the default order between equal ranks.
- `browser.ts`: the entry `@openreloading/api/catalogue`. It imports core and schema only, no Node API (`test/compute-imports.test.ts`). `node.ts` reads and writes the two files (`index.json`, `records.json`), `write.ts` is the build step (`npm run build` writes them into `dist/catalogue/`, also exported as `@openreloading/api/catalogue/*.json`). The server opens them at start (`loadCatalogue`, no database, no wait) and answers a record as stored, without the added `kind`, `origin` and `revision`; the API image gets the files from the same build.

Checks in `packages/api/test/`: `catalogue.test.ts` (derive, build, open, files), `catalogue-parity.test.ts` and `catalogue-budget.test.ts`.

The parity test runs sixteen queries on the SQL layer (PGlite) and on the catalogue, over synthetic records and the public bundle: the cartridge list (all, `q`, `table`, paged), the powder list (all, `q`, `manufacturer`), the bullet list (all, `q`, `manufacturer`, `cartridge`), manufacturers, target faces, federations, disciplines and target mappings. It compares the totals, the sorted ids and the items, not the order of the name-sorted lists (the two orders differ on purpose) and not the paged ids. Further checks: the competition lists keep the same order in both layers (federations, disciplines, target faces, target mappings, both data sets), and every record route answers a body equal to the SQL layer's for every record of both data sets. Where the catalogue finds more than `ilike`, a second test names the difference: words in any order and a number in another printed form.

The budgets, tested as the best of fifteen runs after a warm-up (other test files share the CPU): the index of the public bundle from its records in under 50 ms, from the prebuilt index text in under 9 ms, a ranked page of 50 cartridges in under 5 ms. Measured on the public bundle (577 cartridges, one machine): about 10 ms from the records, 1 ms from the prebuilt index (460 kB, the record file is 3.6 MB and read on the first `get`).

## Triggers for the fallback

The interface stays, only the module that opens the catalogue changes: user entities on the server (accounts, shared records), more than about 200,000 rows or an index over about 200 MB, or ad-hoc relational queries over specification values. SQLite (read-only file, `node:sqlite`) comes first, PostgreSQL second. Both read the same `search` and `sort_key` columns, computed in JavaScript by the functions below, so SQL and the matcher cannot disagree.

## One sort order

Each row has one `sortKey` string, compared by UTF-16 code unit (`compareKeys` in `packages/schema/src/order.ts`). It is the folded names joined by U+001F, every run of digits padded to 8 digits, so "9 mm" sorts before "10 mm" without locale data. The key is identical in Node, the browser and SQL (`collate "C"`).

The server edition orders by `name, id` under the container's locale, the Pages edition's data files come from PGlite (`C`), and for the 577 cartridges 501 positions differ between the two. The web tables sorted by `Intl.Collator`, a third order that depends on the browser's ICU data; they now sort text by `sortKey` too (`sortRows` in `apps/web/src/lib/lists.ts`); the API default order follows it now, and so do the Pages edition's data files, which `writeStaticApi` writes from the API.

## One matcher and ranker

`packages/schema/src/search.ts`:

- `fold(s)`: Unicode NFD, combining marks removed, lower case, a decimal comma between digits written as a point.
- `searchKey(texts, name?)`: the folded texts, the same text with spaces and hyphens removed, and the folded name (default: the first text), joined by U+0001. Built once per row.
- `score(key, query)`: the query is split into words. Each word must occur in the key, as written, without spaces and hyphens, or (for a word that starts with a point and a digit) without the point. A word scores 2 where the best occurrence starts a word of the key and 1 inside one. The whole query equal to the name (ignoring a point that ends a word) adds 4. `undefined` means no match, an empty query ranks 0. The order of a ranked list is score descending, then `sortKey`, then id.

So `win 308` and `308 win` give the same rows with the same scores, and `.308`, `308`, `7,62x51`, `7.62 x 51`, `30 06` and `30-06` find the records that print them in another form. `packages/schema/test/search.test.ts` lists the cases and checks that every permutation of a query's words has the same rank.

## Behaviour changes for the editions

In effect on the server edition and, through its data files, on the Pages edition. Non-breaking for the schema, visible in data: the default list order changes from the locale collation to `sortKey` order on the server edition, `q` becomes ranked and independent of word order, and `q` matches the compact form ("8x57"). The contract version does not change.

## Fallback schema (PostgreSQL 18, also PGlite)

Run on PGlite with the public bundle (load, indexes and `analyze` in one transaction, 299 ms). One table per kind with typed index columns plus the record as `jsonb`, not relational specification values (by id 0.12 ms against 0.13 ms, 4.1 MB against 1.9 MB). Derived columns are written by the seed, never generated columns.

```sql
create extension if not exists pg_trgm;

create domain record_id as text collate "C"
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) <= 100);

create table manufacturer (
  id        record_id primary key,
  name      text not null,
  sort_key  text collate "C" not null,
  search    text not null,
  record    jsonb not null,
  check (jsonb_typeof(record) = 'object' and record ->> 'id' = id and record ->> 'kind' = 'manufacturer')
);

create table bullet (
  id               record_id primary key,
  manufacturer_id  record_id not null references manufacturer (id),
  name             text not null,
  sort_key         text collate "C" not null,
  diameter         double precision not null check (diameter > 0),
  mass             double precision not null check (mass > 0),
  search           text not null,
  record           jsonb not null,
  check (jsonb_typeof(record) = 'object' and record ->> 'id' = id and record ->> 'kind' = 'bullet'
         and record ->> 'manufacturer' = 'catalogue:' || manufacturer_id)
);

create index bullet_order on bullet (sort_key, id);
create index bullet_manufacturer on bullet (manufacturer_id, sort_key, id);
create index bullet_size on bullet (diameter, mass);
create index bullet_search on bullet using gin (search gin_trgm_ops);
```

The other kinds follow the same pattern. Seeding is one transaction: one `insert ... select from jsonb_populate_recordset` per table, then the indexes, then `analyze`; the build takes a transaction-level advisory lock first so two seeds cannot race. Sorted or compared text columns are `collate "C"`; case and accent folding lives in `search` and `sort_key`.

Sources: [PostgreSQL JIT decision](https://www.postgresql.org/docs/18/jit-decision.html), [pg_trgm](https://www.postgresql.org/docs/18/pgtrgm.html), [collation](https://www.postgresql.org/docs/18/collation.html), [`node:sqlite`](https://nodejs.org/api/sqlite.html).
