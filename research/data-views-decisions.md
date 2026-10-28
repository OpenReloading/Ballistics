# Decisions for the data views built from stored records

Question (issue 374): which views the app derives from records the user already stores, each in the cheapest form, and which are ruled out.

Short answer: five views are kept, each as a column, a filter, a row set on an existing tab, a note rule or an export. Two are deferred or ruled out as pages, one already exists and one belongs to the Schiessbuch. No view needs a new stored field. One correction to the issue's table: a target sheet has no date, so the group size cannot sit in the rows by date unless the shots carry a session link (view 1, below). No product code, schema or record changes with this note.

The map's grilling and prototype tickets cannot be answered live. Each answer below is the recommended default, applied with the map's three-part test: the view answers a bench or range question, needs no new entry, and fits as a column, filter or tab. The owner can overrule any row.

## What exists today (checked on `main`, 2026-10-28)

- Stored per user (`userRecord`, `packages/schema/src/user-data.ts:176`): manufacturer, bullet, cartridge, powder, caseCapacity, load, firearm, session, targetSheet, targetFaceDesign, case. Every record carries `name` and `saved`, the time of the last save (`:139`).
- A load names its firearm (`Load.firearm`), its `sessions` (refs, at most 50) and one optional `snapshots` entry per session with `roundCount`, `seating` and the lots (`packages/schema/src/load.ts:140`, `:178`, `:231`, `:238`).
- A session has an optional `date` (`chrono-session.ts`, `date`), and each string names its `load`, so one session can hold strings of several loads.
- A target sheet names a saved load by its record id (`target-sheet.ts`, `load`, a `localId`, not a `user:` ref) and has no date. A group has `distance` and optionally `ladderStep`; a shot may name its chronograph shot (`groupShot.chrono`: session, string, shot).
- A firearm has `roundCount`, `noteAtRoundCount` and a `cartridge` ref, and no category (`firearm.ts`, `roundCount`, `noteAtRoundCount`, `cartridge`).
- A discipline has an optional `category` and `caliberClasses` (ids); a caliber class lists its member cartridge ids (`federation.ts`, `caliber-class.ts`, `cartridges`). The discipline list already shows both columns (`apps/web/src/components/discipline-list.tsx`).
- Already shown: the sessions of a saved load with statistics and the comparison with the simulated velocity (Measurements tab, `stringStats` in `apps/web/src/lib/string-stats.ts`), group sheets and their statistics (Groups tab, `groupStatisticsOf` in `apps/web/src/lib/target-groups.ts`), lots and notes (Notes tab, `loadNotes` in core, `apps/docs/docs/models/load-notes.md`), the printed range card (`apps/web/src/lib/range-card.ts`). `toCsv` is in `apps/web/src/lib/csv.ts`; the session summary exports CSV. Settings' Your data counts records per kind (`apps/web/src/lib/your-data.ts`).
- The Saved loads drawer (`saved-loads.tsx`) is a list grouped by cartridge whose row shows the save time; it has no columns, so "column" below means one more text on the row. The firearm list is a directory table whose cells come from `firearmCells` (`apps/web/src/lib/firearm.ts`).

## Rule of the map

A view is kept when it passes all three tests. T1: answers a bench or range question. T2: needs no new entry. T3: fits as a column, filter, tab, note rule or export, not a new page.

## Verdicts

| # | View | Verdict | Cheapest form | Fields read | Rule |
|---|---|---|---|---|---|
| 1 and 8 | History of a load; ladder results over sessions | keep, first slice | Rows by session on the Measurements tab: date, shots, mean, SD, ES, firearm round count of the snapshot. A "Group size" column from sheets whose shots name that session; sheets with no session link go in a short list of their own, ordered by last save, labelled as such | `Load.sessions`, `Load.snapshots[].roundCount`, `session.date`, `strings[].load`, `shots[].velocity`, `shots[].excluded`, `targetSheet.load`, `groups[].shots[].chrono.session` | passes T1 to T3 |
| 2 | Loads side by side | defer | The bullets compare page is the pattern if the 1.0 feedback asks (#291) | `Load.*` | fails T3 as a new page |
| 3 | Dope card per firearm | rule out as a page | The printed range card per load exists (`range-card.ts`) | none | fails T3, duplicates a shipped output |
| 4 | What I can shoot where | keep | Filter "For my firearm" on `/disciplines`: the classes whose `cartridges` list holds the firearm's `cartridge` id; the category chip stays as it is | `Firearm.cartridge`, `CaliberClass.cartridges`, `Discipline.caliberClasses` | passes T1 to T3 |
| 5 | Model against measurement | exists | Measurements tab compares simulated and measured velocity; the tuning feed belongs to #285 | none | already shipped |
| 6 | Data quality | keep | New `loadNotes` rules naming inputs that are still a record default or empty: powder, primer and case lot, case capacity, bullet mass | `Load.powderLot`, `primer.lot`, `case.lot`, `Load.case`, `analysis.overrides` | passes T1 to T3 |
| 7 | Stale and untested | keep | Saved loads row: "n sessions, last <date>"; firearm list column "Last session" | `Load.sessions`, `session.date`, `Load.firearm` | passes T1 to T3 |
| 9 | Yearly summary | rule out for now | Belongs to the Schiessbuch (#218, after 1.0) | none | fails T1 for a bench or range question, overlaps #218 |
| 10 | CSV of any list | keep | "Export CSV" in the Saved loads drawer and on the firearm list with `toCsv` | the rows of views 7 and 1 | passes T1 to T3 |

### Findings behind the table

- **Group size has no date.** A sheet stores no day. Its record `saved` changes on every edit, so it is not a shooting date and is not used as one. A group can be placed on a session only where its shots carry `chrono.session`. Where they do not, the sheet appears in its own short list. A stored sheet date would need a new field; it is not proposed.
- **A session without a date.** `date` is optional. "Last session" shows the latest date among dated sessions and states "no date" when none has one. Order by `Load.sessions` is the fallback the notes already use (`load-notes.md`, "What a session holds").
- **One session, several loads.** Statistics use only the strings whose `load` is this load, as the Measurements tab does. A string not mapped to the load's charge is read as the notes do (`load-notes.md`, Limits).
- **User cartridges.** `CaliberClass.cartridges` holds catalogue cartridge ids. A firearm chambered for a user cartridge design, or none, matches no class, and the filter says so in its empty state instead of listing nothing silently.
- **Overlap with #373.** The map for the load and firearm connection also lists a caliber-class filter on the discipline list and the Saved loads columns. Both belong to one change each, not two.

## Architecture rule

A view is a pure function from the stored records to rows, in `apps/web/src/lib/`. No stored copy of a field, no index, no second store. The same function shape serves loads, brass and later batches (#353): it takes records of a kind and returns rows.

## One place for views

Columns and filters on the existing list or tab. Settings' Your data (#264) stays a count per kind, not a dashboard. The Saved loads row text and the firearm list column come first because the data is already in the store when the list opens.

## Cost of deriving

Synthetic store: 500 loads of 10 sessions each (5,000 sessions of 3 strings of 5 shots), 2,000 target sheets of 2 groups of 5 shots, 30 firearms, 7,530 records, 5.5 MB as JSON. The derivations are a throwaway script (below) that implements views 1, 7 and 10 in plain JavaScript with the data flow the build would use: one id map of sessions, one grouping of sheets by load. Node 26.11.1 on the host, 50 repetitions after a warm-up, not a browser.

| Derivation | Median | Worst of 50 |
|---|---|---|
| View 1 for one load (rows plus group sizes) | 0.39 ms | 1.37 ms |
| View 1 for all 500 loads | 6.2 ms | 11.1 ms |
| View 7 for all loads and firearms | 0.52 ms | 1.11 ms |
| View 10, CSV of the 500 Saved loads | 0.55 ms | 0.76 ms |
| Parsing the 5.5 MB store as JSON (for scale) | 17.9 ms | single run |

All are far below the 50 ms line the issue sets. Not measured: reading the store from IndexedDB, rendering, and a browser engine other than V8. The first is the larger cost and is already paid by the lists today. Decision: no index and no stored summary. The line to revisit is a derivation over 50 ms in the browser.

Command: save the script below as `views-timing.mjs` and run `node views-timing.mjs` (no dependencies). It is part of this note only and is not product code.

```js
// Throwaway timing of three view derivations over a synthetic store (not product code).
const L = 500, S = 5000, T = 2000, F = 30
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const uid = (p, i) => `user:${p}-${i}`
const firearms = Array.from({ length: F }, (_, i) => ({ id: uid('f', i), kind: 'firearm', data: { roundCount: Math.floor(rnd() * 5000), cartridge: 'catalogue:c' + (i % 8) } }))
const sessions = Array.from({ length: S }, (_, i) => ({
  id: uid('s', i), kind: 'session',
  data: { date: `20${20 + Math.floor(rnd() * 6)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
    strings: Array.from({ length: 3 }, () => ({ load: uid('l', Math.floor(i / 10)), shots: Array.from({ length: 5 }, () => ({ velocity: { value: 800 + rnd() * 20 } })) })) },
}))
const loads = Array.from({ length: L }, (_, i) => {
  const refs = sessions.slice(i * 10, i * 10 + 10).map((s) => s.id)
  return { id: uid('l', i), kind: 'load', saved: '2026-10-01T00:00:00Z', name: 'Load ' + i,
    data: { firearm: firearms[i % F].id, sessions: refs, snapshots: refs.map((s, k) => ({ session: s, roundCount: k * 50 })) } }
})
const sheets = Array.from({ length: T }, (_, i) => ({ id: uid('t', i), kind: 'targetSheet',
  data: { load: loads[i % L].id, groups: Array.from({ length: 2 }, () => ({ shots: Array.from({ length: 5 }, () => ({ x: rnd() * 0.02, y: rnd() * 0.02 })) })) } }))
const records = [...firearms, ...sessions, ...loads, ...sheets]

const stats = (v) => { const n = v.length, m = v.reduce((a, b) => a + b, 0) / n
  return { n, mean: m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : undefined, es: Math.max(...v) - Math.min(...v) } }
const spread = (shots) => { let d = 0; for (let i = 0; i < shots.length; i++) for (let j = i + 1; j < shots.length; j++) d = Math.max(d, Math.hypot(shots[i].x - shots[j].x, shots[i].y - shots[j].y)); return d }
const byId = (rs) => new Map(rs.map((r) => [r.id, r]))
const sessionRows = (load, sess, sheetsOfLoad) => load.data.sessions.map((id) => {
  const s = sess.get(id).data, snap = load.data.snapshots.find((x) => x.session === id)
  const v = s.strings.filter((x) => x.load === load.id).flatMap((x) => x.shots.map((h) => h.velocity.value))
  return { date: s.date, ...stats(v), roundCount: snap?.roundCount } }).sort((a, b) => a.date.localeCompare(b.date))
const history = (load, sess, sheetsOfLoad) => ({ rows: sessionRows(load, sess, sheetsOfLoad), groups: sheetsOfLoad.flatMap((t) => t.data.groups.map((g) => spread(g.shots))) })
const view1One = () => { const sess = byId(sessions), l = loads[0]; return history(l, sess, sheets.filter((t) => t.data.load === l.id)) }
const view1All = () => { const sess = byId(sessions), by = Map.groupBy(sheets, (t) => t.data.load); return loads.map((l) => history(l, sess, by.get(l.id) ?? [])) }
const view7 = () => { const sess = byId(sessions), last = new Map()
  const rows = loads.map((l) => { const d = l.data.sessions.map((id) => sess.get(id).data.date).sort(); const lastDate = d.at(-1)
    const f = l.data.firearm; if (lastDate && (last.get(f) ?? '') < lastDate) last.set(f, lastDate)
    return { id: l.id, sessions: d.length, last: lastDate } }); return { rows, last } }
const csv = (rows) => rows.map((r) => r.map((c) => { const t = String(c); return /[",\n\r]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t }).join(',')).join('\n')
const view10 = () => { const v = view7(); return csv([['Name', 'Sessions', 'Last session'], ...loads.map((l, i) => [l.name, v.rows[i].sessions, v.rows[i].last ?? ''])]) }
const time = (name, f, reps = 50) => { f(); const t = []; for (let i = 0; i < reps; i++) { const a = performance.now(); f(); t.push(performance.now() - a) } t.sort((a, b) => a - b)
  console.log(`${name}: median ${t[reps >> 1].toFixed(2)} ms, max ${t.at(-1).toFixed(2)} ms`) }
console.log(`store: ${records.length} records, ${loads.length} loads, ${sessions.length} sessions, ${sheets.length} sheets, node ${process.version}`)
time('view 1, one load (history rows)', view1One)
time('view 1, all 500 loads', view1All)
time('view 7, sessions and last session per load and firearm', view7)
time('view 10, CSV of the Saved loads', view10)
console.log('JSON size of the store: ' + (JSON.stringify(records).length / 1e6).toFixed(1) + ' MB; parse: ' + (() => { const s = JSON.stringify(records), a = performance.now(); JSON.parse(s); return (performance.now() - a).toFixed(1) })() + ' ms')
```

## What a view must not claim

A trend describes past sessions. No text says a load is better, safer, stable, or should be used. A "Last session" or "not shot" text states a date or a count. A data-quality note says an input is still the record's default; it does not say the load is wrong. Results stay simulations.

## Wireframes (text, five kept views)

View 1, Measurements tab, below the existing session cards:

```
Sessions of this load
Date        Shots  Mean m/s  SD m/s  ES m/s  Rounds through firearm  Group (ES, 100 m)
2026-03-14    10     821.4     5.2    16.0                   410        24 mm
2026-06-02     5     819.9     7.1    19.0                   620        n/a
2026-09-20    10     822.0     4.8    14.0                   905        28 mm
Sheets with no session link (last saved)
  Range day A      2026-09-20     2 groups     (opens the Groups tab)
```
Empty state: "No sessions yet. Add a chronograph session on this tab." A session without a date shows "no date" and keeps the order of the load's sessions.

View 4, `/disciplines`: filter chip "For my firearm" with a select of the user's firearms. Empty state: "No discipline lists the caliber class of <firearm>. A firearm without a catalogue cartridge matches no class."

View 6, Notes tab, one line per finding in the existing note style: "Case capacity is the record's value; no measured capacity is saved with this load."

View 7, Saved loads row: `<name>  <cartridge>  3 sessions, last 2026-09-20` or `No sessions`. Firearm list: column "Last session" with a date or `n/a`.

View 10: button "Export CSV" in the page action row of the Saved loads drawer and the firearm list. Columns are the visible ones, in the unit system of Settings.

## Build issue drafts (none opened)

1. Pure function `loadHistory` in `apps/web/src/lib/` and the session rows with round count on the Measurements tab. Resolved when: a test with two sessions and one string of another load returns only this load's strings, and a session without a date keeps the load's order.
2. Group size beside the rows: group sheets matched through `chrono.session`, the rest listed apart. Resolved when: a test places a group whose shots name a session on that row and lists a sheet with no link in the separate list, and no stored shape changes.
3. Saved loads row text and the firearm list column "Last session" from one function `lastSession`. Resolved when: a test returns the latest dated session, `no date` for undated sessions and none for a load with no sessions; shared with the #373 columns.
4. `loadNotes` rules for inputs left at the record default. Resolved when: a test for each rule, a model page update in `apps/docs/docs/models/load-notes.md`, and the note text states the input, not a verdict.
5. "For my firearm" filter on `/disciplines` and "Export CSV" in the Saved loads drawer and firearm list. Resolved when: a test maps a firearm to its caliber classes through `CaliberClass.cartridges`, a firearm with a user cartridge matches none with its empty state, and the CSV text of a row set equals `toCsv` of the same rows.

No draft adds a stored field.

## Ruled out, one line each (for the research log)

- Loads side by side (2): a new page fails T3 and the bullets compare page is the pattern if feedback asks; revisit after 1.0 feedback (#291).
- Dope card per firearm (3): the printed range card per load already answers it; a per-firearm page adds no data.
- Yearly summary (9): rounds per year and sessions per month overlap the Schiessbuch (#218) and answer no bench or range question; revisit with it after 1.0.
- Model against measurement (5): not ruled out, already shipped on the Measurements tab; the feed for powder tuning is #285.

## Depends on #373

- The Saved loads row text (drafts 3 and 5) and the firearm list column share their place with #373's "On hand" and "Loads" columns. Whichever lands first fixes the row layout; the other adds its text. Both are derived, so no ordering is forced on the data.
- The "For my firearm" filter (draft 5) is the caliber-class filter #373 lists as its view 6. One pull request builds it; the other issue links to it.
- The round count in the rows (draft 1) uses `Load.snapshots`, which exists today.

## Not checked

- No browser run, no IndexedDB read and no rendering of the wireframes. The timings are Node, not a browser.
- The wireframe texts are drafts for the owner to react to; none was put through the translation or the visual-check step.
- Whether a stored sheet date is worth adding before 1.0 is left to the owner (it would be a stored-shape change).
