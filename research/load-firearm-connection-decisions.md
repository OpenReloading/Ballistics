# Load and firearm connection: quantities and the enough-for-the-match view

Decision note for issue #373. Repository facts are from `main` at d9cfa7a7 (2026-10-28). No product code, schema, record data or other issue is touched. The owner may overrule every answer; each carries the cost of being wrong and a reversible default.

## Answer in short

- The first slice adds one optional object to the stored `Load`: `stock: { count, counted }` (rounds on hand and the day they were counted). No other stored shape changes.
- The link stays one edge, `Load.firearm`. Every view is a query over the records already in the store.
- Views 1, 3 (on hand only), 5 and 4 are kept in slices; 6 is kept as a filter in the discipline list; 2 reduces to a column; 7 and the "made" and "fired" parts of 3 fail the one-minute test and are ruled out.
- "Match check" compares rounds on hand with a typed or rule-book count. It says nothing about whether the rounds are good.

Confidence: medium. The answers are design choices from the code as it is; no handloader was asked (#291 is the usability check). The timings are a model of the derivation, not of the browser store.

## What the test asks

Every view must pass: would a handloader fill it in at the bench in under a minute, with what they already know? The cheaper forms are compared first: a typed number, a column or filter on an existing list, a CSV export.

## Facts the answers rest on

| Fact | Where |
|---|---|
| A load names one firearm and one cartridge, both optional references | `packages/schema/src/load.ts:177-178` |
| A load lists its sessions; a snapshot keeps the firearm's round count at that session | `load.ts:231`, `load.ts:238`, `sessionSnapshot` |
| A firearm has `cartridge`, `roundCount` and `noteAtRoundCount`; nothing for rounds made or on hand | `packages/schema/src/firearm.ts:122`, `:145`, `:146` |
| A firearm has no category field; a discipline has `category` and `caliberClasses` | `firearm.ts`, `packages/schema/src/federation.ts` (`discipline`) |
| A caliber class lists its cartridge ids | `packages/schema/src/caliber-class.ts` (`cartridges`) |
| `shotCount` and `stage` are optional on a target mapping; 389 of 418 mappings state `shotCount`, 66 state a `stage` | `federation.ts:123`, `:127`; `packages/data/records/target-mappings` |
| 23 of the 376 disciplines have a mapping without `shotCount`; 32 have more than one stage | same records (counted 2026-10-28) |
| `checkUserRefs` reports a reference that names no user record, drops nothing, and covers a load's `firearm` | `packages/schema/src/user-data.ts:277` |
| A chronograph session has an optional `date`; its strings name their load and hold the shots | `packages/schema/src/chrono-session.ts:85` and the string shape |
| The load note rules read `SessionReading` (lots, seating, round count, velocity), not the link | `packages/core/src/load-notes.ts:31`, `apps/web/src/lib/load-notes.ts` (`notesOf`) |
| Saved loads is a drawer: records grouped by cartridge, one line each (name, saved time, four icon buttons), not a table | `apps/web/src/components/saved-loads.tsx:232` and below |
| The Your data rows count records per kind | `apps/web/src/lib/your-data.ts:28` |
| Every list reads `storedRecords`, which parses every stored record with the schema | `apps/web/src/lib/user-store.ts:71` |

## The seven views

| # | View | Verdict | Reason |
|---|---|---|---|
| 1 | Per firearm: its loads, cartridge, charge, last session | Keep, slice 2 | Derived from `Load.firearm`; nothing to type. "Last session" shows "no date" where the session has none (`date` is optional) |
| 2 | Per load: firearms used in | Keep as one column | One edge means one firearm per load; the view is the firearm's name on the load line. A load for two guns is a copy (Save as) |
| 3 | Made, on hand, fired | On hand: keep. Made and fired: ruled out as stored fields | Made needs a retype at every loading session; fired needs one at every range day. A stored count that nobody updates is wrong in a way the screen cannot show. The barrel's round count already exists on the firearm |
| 4 | Enough for the match | Keep, slice 4 (after #18 for sighters) | The case that drives the map |
| 5 | Gaps | Keep, slice 3 | Derived, nothing to type |
| 6 | Which firearm and load qualify for a discipline | Keep as a filter in the discipline list | Chain: firearm `cartridge` to caliber class `cartridges` to discipline `caliberClasses`. The firearm has no category, so the first cut filters by caliber class only; a firearm category would be a stored-shape change and is not added |
| 7 | Barrel life against rounds made | Ruled out before 1.0 | Needs rounds made and a checkpoint per barrel. `noteAtRoundCount` already gives a checkpoint note at sessions |

Views that fail the one-minute test, ready for the research log (#355):

- Rounds made as a stored count: retyped at every loading session, wrong the first time one is skipped.
- Rounds fired as a stored count or an automatic subtraction: sessions record only chronographed strings, so a subtraction undercounts what was shot and hides a real shortage.
- Barrel life with a rounds-left display: needs both of the above.
- Automatic decrement of stock after a session: same reason; it is information, not a state.

## Answers per ticket

| Ticket | Answer | Cost of being wrong | Rests on |
|---|---|---|---|
| Which views | See the table above | Low: each is a column, note or filter | the views table |
| Where the quantity lives | One optional record on the load: `stock: { count: integer >= 0, counted: ISO date }`. The user retypes it after a loading session or a range day. No made or fired fields. The count sits on the load, not the firearm, because the same rounds belong to one recipe | Low: additive and optional. The batch design (#353) may replace it; an import then turns a stock into the first batch | `load.ts` (`loadShape`); #353 |
| What a correction is | Typing a new number sets `counted` to today. A mistyped number is overwritten; no history is kept | Low | `stock` |
| Made, on hand, fired | Only "on hand, counted on a date" is stored. "Fired" is shown as information: the shots of the load's strings in sessions dated after `counted`, labelled "recorded in sessions". It is never subtracted | A subtraction would hide a shortage, so none is made | `chrono-session.ts` |
| Where "needed" comes from | Slice 1: not used. Slice 4: the shots of a chosen discipline (sum of `shotCount` over its mappings of one stage or all), typed sighters and a typed reserve percent. Defaults 0 sighters and 10 percent reserve | Low: plain inputs | `federation.ts:127` |
| Event side of the rule data | `shotCount` is stated for 389 of 418 mappings. For the other 29 (23 disciplines) the screen says "not stated" and asks for a typed number. Sighters, series and time limits wait for #18 | None | counts above |
| Model of the link | One edge, `Load.firearm`; no stored duplicate on the firearm. A deleted firearm leaves the load with a reported missing reference (`checkUserRefs`); the load stays. Export and import carry the reference as the user data file does today | Low | `user-data.ts:277` |
| Cost of deriving | See Timings. Default: no index | Revisit above 50 ms of derivation | Timings below |
| Reminders | Slice 3 puts the number of gaps in Your data. A shortfall count needs a stored plan; the match check keeps its inputs on the screen only, so there is no shortfall count and no notification. A stored plan (a `needed` number) would be a second stored-shape change: it is not added, and the owner can add it before 1.0 | Low: the match check works without it | `your-data.ts:28`, #353 |
| What it must not claim | See the last section | Low | |

## Stored shape

The first slice adds one field to `Load` and changes nothing else:

```
stock?: {
  count: integer, at least 0       rounds on hand
  counted: ISO date (YYYY-MM-DD)   the day they were counted
}
```

- Both members are required when the object is present. A load without `stock` is unchanged.
- A catalogue load carries no `stock` (a catalogue load is a published recipe, not a stock). This is a check in the load refinement, reversible.
- The field is added to the freeze list of #405 (user data has no freeze check today). It is decided before 1.0 because a shape changed after 1.0 costs a migration.
- Nothing is added to `Firearm`, `ChronoSession` or the user data file envelope.

## Wireframes (text, not a page)

Each state shows what the screen says; the wording makes no claim about the rounds.

Saved loads line, slice 2 (the drawer has lines, not columns; #374 changes the same drawer):

```
.308 Win
  Match 168 gr        On hand 90, counted 2026-09-12      [rename][copy][export][delete]
  Practice 175 gr     On hand not counted                 [rename][copy][export][delete]
```

Firearm list row, slice 2:

```
Rifle A (.308 Win)     Loads 2     On hand 90 (oldest count 2026-09-12)
Rifle B (6.5 CM)       Loads 0     No load for this cartridge
```

Match check, slice 4, one firearm and one discipline chosen. Empty state:

```
Firearm  [Rifle A v]    Discipline [pick one v]    Match date [ ]
Choose a discipline to see the shots it states.
```

Shortfall state:

```
Shots stated by the rule book: 100       Sighters (typed): 0       Reserve (typed): 10 %
Needed: 110
On hand: 90 (counted 2026-09-12, 30 days before the match date)
Short by 20
```

Surplus state: `On hand: 140 ... 30 over`.

Stale-count state: the count date is always shown; a count made after the match date is shown as such ("counted after the match date"). No staleness threshold is stored; the date speaks for itself.

Discipline without a stated shot count: `Shots: not stated for this discipline. Type the number.`

## Build issues (drafts, one pull request each)

1. Schema: optional `Load.stock` (`count`, `counted`), JSON schema regenerated, the user data page `apps/docs/docs/data/record-model.md` states it, the #405 freeze list names it. Resolved when: a load with `stock` `{ count: 0, counted: '2026-10-01' }` parses; a negative or fractional count, a malformed date and a catalogue load with `stock` fail; a load without `stock` parses as before; `npm test -w @open-reloading/schema` passes.
2. Saved loads and workbench: an "On hand" field with the counted date (set to today when the number changes) in the workbench, and the line of the saved load shows it. Waits for #374 (same drawer) and #296 (where the field sits). Resolved when: typing 90 saves `{ count: 90, counted: <today> }`, the drawer line shows both, and an empty field removes `stock`.
3. Firearm list: "Loads" and "On hand" per firearm, derived from `Load.firearm` and `stock`. Resolved when: a firearm with two loads of 90 and 30 shows Loads 2, On hand 120; a firearm with no load shows 0; no value is stored on the firearm.
4. Gaps: notes for a load without a firearm, a firearm with no load for its cartridge, a load whose cartridge differs from its firearm's, and their count in Your data. A pure function over the loads and firearms; `loadNotes` reads session readings only and is not extended. Resolved when: each of the three cases yields one note and the count in Your data matches, in a unit test with a store of the three cases and one clean pair.
5. Match check (after #18 for sighters): chosen discipline gives the shots, typed sighters and reserve, the shortfall or surplus against the on-hand sum of the chosen loads of one firearm. Resolved when: shots 100, sighters 0, reserve 10 %, on hand 90 shows Needed 110 and Short by 20; a discipline without `shotCount` asks for a typed number; the screen text contains none of the words safe, enough or recommended.

The discipline-list filter (view 6) is a sixth small pull request and is left to the owner's order: it needs no stored shape.

## Timings

The script below builds 40 firearms, 500 loads and 5,000 sessions of 3 strings with 10 shots each as plain objects, and runs the three derived lists 20 times (Node 26.11.1, one run on the dev host):

| Derivation | Median | Max |
|---|---|---|
| Firearm list: loads and on-hand per firearm | 0.15 ms | 0.31 ms |
| Saved loads: shots in sessions after the count, per load | 0.87 ms | 1.60 ms |
| Gaps: three kinds | 0.08 ms | 0.13 ms |

A session without a `date` is skipped by the second list and counted nowhere. All three are far below 50 ms, so no index is needed. Not measured, and not part of this model: the IndexedDB read of the `records` store and the schema parse that `storedRecords` runs on every record before any list (`user-store.ts:71`). That cost exists today for every list and does not depend on this feature; the build issues should not add a second read of the store. Unverified in a browser.

## What the feature must not claim

- "On hand" is the number the user typed on the date shown. It says nothing about the condition, safety or accuracy of the rounds.
- The match check compares two numbers. The words safe, enough, ready and recommended are not used on screen or in docs; the result reads "Short by N" or "N over".
- A stock is bookkeeping, not a load recommendation. A charge shown beside a stock is the user's own recipe.
- A count older than the match date is shown with its date; no automatic subtraction of rounds fired is made.

## Dependencies and open points

- #374: the Saved loads drawer and its lines are shared; build issue 2 follows its layout decision.
- #18: sighters, series and time limits; build issue 5 types sighters until it lands.
- #353: batches may replace `stock`; an import turns a stock into the first batch.
- #405: add `Load.stock` to the stored-shape freeze list.
- #296: where the "On hand" field sits in the workbench.
- Open for the owner: a stored plan (`needed`) for a shortfall count in Your data (default: not added); a firearm category field for view 6 (default: not added).

## Appendix: the timing script

```js
// Synthetic store: 500 loads over 40 firearms, 5000 sessions of 3 strings x 10 shots.
const N_LOADS = 500, N_FIREARMS = 40, N_SESSIONS = 5000
const firearms = Array.from({ length: N_FIREARMS }, (_, i) => ({ id: `f${i}`, kind: 'firearm', data: { cartridge: `user:c${i % 8}`, roundCount: i * 10 } }))
const loads = Array.from({ length: N_LOADS }, (_, i) => ({
  id: `l${i}`, kind: 'load',
  data: { firearm: i % 7 === 0 ? undefined : `user:f${i % N_FIREARMS}`, cartridge: `user:c${i % 9}`, stock: { count: i, counted: '2026-10-01' }, sessions: [] },
}))
const sessions = Array.from({ length: N_SESSIONS }, (_, i) => {
  const load = `user:l${i % N_LOADS}`
  loads[i % N_LOADS].data.sessions.push(`user:s${i}`)
  return { id: `s${i}`, kind: 'session', data: { date: `2026-0${1 + (i % 9)}-15`, strings: Array.from({ length: 3 }, () => ({ load, shots: Array.from({ length: 10 }, () => ({ v: 800 })) })) } }
})
const records = [...firearms, ...loads, ...sessions]
const id = (ref) => ref?.replace(/^user:/, '')
const time = (name, f) => {
  f()
  const t = []
  for (let i = 0; i < 20; i++) { const s = performance.now(); f(); t.push(performance.now() - s) }
  t.sort((a, b) => a - b)
  console.log(name.padEnd(48), 'median', t[10].toFixed(2), 'ms  max', t[19].toFixed(2), 'ms')
}
// 1. Firearm list: loads per firearm and the on-hand total
time('firearm list: loads and on-hand per firearm', () => {
  const by = new Map()
  for (const r of records) if (r.kind === 'load') { const f = id(r.data.firearm); if (f) { const e = by.get(f) ?? { n: 0, onHand: 0 }; e.n++; e.onHand += r.data.stock?.count ?? 0; by.set(f, e) } }
  return by
})
// 2. Saved loads: shots fired since the count, per load
time('saved loads: shots since counted, per load', () => {
  const byId = new Map(records.map((r) => [r.id, r]))
  return loads.map((l) => {
    let shots = 0
    for (const s of l.data.sessions) { const rec = byId.get(id(s)); if (rec && rec.data.date > l.data.stock.counted) for (const st of rec.data.strings) if (st.load === `user:${l.id}`) shots += st.shots.length }
    return shots
  })
})
// 3. Gaps: three kinds
time('gaps: no firearm / no load for a firearm / mismatch', () => {
  const fById = new Map(firearms.map((f) => [f.id, f]))
  const loaded = new Set()
  let none = 0, mismatch = 0
  for (const l of loads) { const f = fById.get(id(l.data.firearm)); if (!f) { none++; continue } loaded.add(`${f.id}|${l.data.cartridge}`); if (f.data.cartridge !== l.data.cartridge) mismatch++ }
  return [none, mismatch, firearms.filter((f) => !loaded.has(`${f.id}|${f.data.cartridge}`)).length]
})
```
