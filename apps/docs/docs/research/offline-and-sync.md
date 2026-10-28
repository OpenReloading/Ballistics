---
title: Offline use and later sync of user data
description: Which actions of the web app work offline today, what 1.0 still needs, and the sync design for a later hosted edition, with its unit, conflict rule and rejected transports.
---

# Offline use and later sync of user data

## Question

Web app, user data: which actions must work without a network, and how do records a person entered on one device reach another one, with which unit of sync, conflict rule and transport?

## Method

Decided before the work: a reading of the code of the static export (service worker rules, data file reads, browser store, file menu) and of the browser storage documentation, no build and no measurement. Every row of the offline matrix names the code that decides it. Accept rule for a sync design: no silent loss of a record a person typed, nothing personal on a server without an account the person chose, and no change to the user data file before the 1.0 freeze unless the design cannot work without one.

Premises of the question corrected by the reading:

- User records carry `saved` (an ISO time of the last save), not `revision` (`packages/schema/src/user-data.ts`, `base` at line 139). `revision` belongs to catalogue records; a user variant keeps the base record's revision as `basedOnRevision` to tell that the base changed.
- The server edition of the web app is gone: the web app is the static export and runs the API's compute entry in the browser (`apps/web/src/lib/static-api.ts`). `compose.yaml` starts only `api` and `docs`.
- The stable and `next` editions of one origin keep separate databases, caches and keys (`storageName` in `apps/web/src/lib/edition.ts`), so a record saved in one edition is not seen by the other.

## Formulas

None: a design question. The conflict test is the one two tabs already use: a writer that last read a record saved at time $b$ may replace the stored record $s$ when $s$ is absent or $s.\mathit{saved} = b$ (`fits` in `apps/web/src/lib/user-store.ts`, line 120). `saved` is compared for equality only, never ordered, so the clocks of two devices need not agree.

## Numbers

Offline matrix of the static export. "Today" is after one online visit with a service worker in control. Effort: S is one small pull request, M a larger one.

| Action | Works offline today | Needed for 1.0 | Effort | Code |
| --- | --- | --- | --- | --- |
| Open the tool pages (home, workbench, session summary, shot groups, firearms, case group editor, range mode, bullet and cartridge designers) | yes, precached | yes | none | `shellPages`, `apps/web/src/lib/offline.ts` line 21 |
| Open a list page (cartridges, bullets, powders, cases, primers, targets, disciplines, federations), the powder and target designers, bullet compare, burn rates | only once opened online (network-first page cache) | yes | S | `strategyOf`, `offline.ts` |
| List rows, list search and site search | yes: the catalogue index is precached and searched in the browser | yes | none | `catalogueFile`, `offline.ts` line 80 |
| Open a catalogue record page | only a record opened online before | no (offline page answers) | none | `keepForOffline`, `apps/web/src/lib/data-file.ts` line 12 |
| Workbench run with catalogue components | only when the cartridge, bullet and powder files were read online before, else the run fails as a failed request | yes, for the components a person uses | S | `findRecord`, `static-api.ts` line 176 |
| Workbench run with the person's own designs, lot rows, charge target | yes (compute in a Web Worker, records in the browser store) | yes | none | `static-api.ts` |
| Range mode entry, session summary, shot groups with photo scoring, firearm library, case groups | yes, browser store only | yes | none | `apps/web/AGENTS.md`, `/range` |
| Save, Open, Import, Export all, print | yes, local files | yes | none | `apps/web/src/components/file-menu.tsx` |
| Workspace folder | yes where the browser has a folder picker (Chrome 86, Chrome Android 132; not Firefox or Safari) | no | none | `apps/web/src/lib/workspace-folder.ts` |
| German interface | yes once the catalogue chunk is precached | yes | none | `apps/web/AGENTS.md`, Language |
| Docs site | no, left to the network | no | none | `offline.ts` line 127 |
| First visit, install, update to a new version | no | cannot | none | |
| Copy between devices | only by file (Export all, Import, workspace folder) | file is enough | none | |

Browser storage (MDN, [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)): Chromium and Safari allow about 60 percent of the disk per origin, Firefox 10 percent best-effort; under storage pressure whole origins are evicted, least recently used first, except persistent ones. Safari deletes script-written data of an origin without a user interaction in the last 7 days of browser use when cross-site tracking prevention is on. `persist()` is granted silently by Chromium and Safari from the site's use, Firefox asks. The app asks for persistent storage at the first save (`requestPersistentStorage`, `user-store.ts` line 194) and says once when the browser refuses it. Folder picker support: [MDN browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Window.json), `showDirectoryPicker`.

The catalogue records are 1484 files of 8.1 MB in `packages/data/records`; the size of the exported data files was not measured.

## Result

no change. Design decided, nothing built.

Offline for 1.0: the gaps are the pages not in the precache and the catalogue records a run needs. Precache every page route of the export (list pages, designers, compare, burn rates; not the record pages), and keep the cartridge, bullet and powder files of every saved load and design in the records cache when it is saved or opened, so a load saved online runs offline. The whole catalogue is not precached.

Sync: the standalone and Pages editions keep file transport (Export all, Import with its per-record Replace prompt, the workspace folder) and get no sync. A hosted edition after 1.0 adds its own sync service with accounts; the compute and catalogue API stays separate.

- Unit of sync: one user record by `id`, as stored, with the photos it points at.
- Conflict rule: a record changed on both sides since the last sync (the test under Formulas, with the `saved` both sides had at the last sync as $b$) is shown to the person, who keeps one or keeps both (the other as a copy with a new id). A record changed on one side only is taken. This is the rule Import already applies (`planImport`, `apps/web/src/lib/user-data.ts` line 223, then Replace).
- Deletes: `deleteRecords` removes a record outright (`user-store.ts` line 172), so a record deleted on one device returns with the next import of the other device's export. File transport accepts that, and the Import report should say so; a sync service needs a delete log.
- Storage format: the user data file needs no change. A 1.0 reader strips unknown keys (the record envelope and `userDataFile` are `z.object`, `packages/schema/src/user-data.ts` lines 155 and 239), so sync metadata in the file would be lost on the next save of an older app. The last synced `saved` per id and the delete log go in a separate `sync` store of the browser database, added by a new database version the way `upgrade` already adds stores (`user-store.ts` line 22), which moves no record. So nothing has to be reserved before the 1.0 freeze, and the sync part needs no issue before 1.0.

Rejected:

- Last write per record wins: loses one side of a range session typed on two devices, without a word.
- Field merge: the records are nested (shot groups, ladders) and their fields depend on each other (units, references), so a merged record can fail the schema.
- A file or folder the person chooses as sync transport: the folder picker is missing in Firefox and Safari, also on iOS, so the phone at the range cannot use it; it stays a save target.
- Storage the person owns (WebDAV, Git): a static page needs the server to allow its origin (CORS) and keeps the person's credentials in the browser; setup is beyond most users (unverified for each provider).
- Device to device (WebRTC): needs a signalling server anyway and both devices online at once.

Before 1.0 there are no real users, so loss of browser data at a format change is accepted and no migration is built; export (file, JSON, print) is a feature of every kind of data. From 1.0 the user data file is frozen, and migrations start with its first change.

## Data basis

analytic. Reading of the code of the web app and the schema at the commit of this entry, and the MDN pages cited; no measurement.

## Where in the app

- `apps/web/src/lib/offline.ts`
- `apps/web/src/lib/data-file.ts`
- `apps/web/src/lib/static-api.ts`
- `apps/web/src/lib/user-store.ts`
- `apps/web/src/lib/user-data.ts`
- `apps/web/src/lib/workspace-folder.ts`
- `packages/schema/src/user-data.ts`

## Confidence

medium. The matrix comes from reading the code, not from a run with the network off; the precache of page routes and the record files of saved loads are the two places a run should confirm.
