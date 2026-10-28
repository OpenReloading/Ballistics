# Decisions for the lifecycle of a fitted user powder

Question (issue 286): how a powder the user fitted to their own strings is saved, refitted, versioned, shared and marked, how the prior from similar powders is used, and what the temperature fit needs.

Short answer: eight recommended decisions, one stored-shape change (an optional `fit` block on `UserPowder`), five build drafts. No row depends on the screen chosen in issue 285, which is still open. A share link of a powder with a 5-charge fit block is 1,103 characters, far below the 8,000 limit. Four findings correct or sharpen the spec: the temperature fit needs no core extension (row 7), `loadNotes` reads sessions only (row 3), an in-place edit of a design already changes the loads that use it (row 3), and the designer marks a burn-form constant as fitted although the ladder fit never frees one (row 8). No product code, schema or record changes with this note.

Every row is a recommended default, reversible before the freeze. The owner can overrule any row.

## What exists today (checked on `main` at 400863a5, 2026-10-28)

- A user powder is a user record of kind `powder` whose `data` is `userPowder`: `origin`, an optional `provenanceKind` and an optional `draft` (`packages/schema/src/user-data.ts`, `userPowder`). Every user record carries `id`, `name` and `saved`, the time of the last save (same file, `base`). `provenanceKind` is one of published, measured, derived, fitted, computed (`packages/schema/src/provenance.ts`, `provenanceKind`).
- The powder designer builds the record (`apps/web/src/lib/powder-designer.ts`: `fileData`, `fromFile`, `powderOf`). `fittedKeys` lists the parameters the designer lets the user mark as fitted: `vivacity`, `energy`, `form.a`. The workbench's Powder search lists valid designs as "<name> (your design)" (`powderDesigns`), their fields' marks say "user design", and a saved load keeps `user:<id>` as its powder (`apps/web/AGENTS.md`, powder designer).
- A load keeps only the reference and the values typed over it, so a later edit of the design changes what the load runs with; the note still names the design (`apps/web/AGENTS.md`, powder designer, Workbench).
- `Powder.trainingRows` and `trainingCartridges` count the load-table rows a catalogue fit used (`packages/schema/src/powder.ts`). Nothing in `packages/schema/src` records the ladder or the sessions a user fit rests on: `sessions` appears only on loads and target sheets (`user-data.ts`, `userRefFields`).
- Core: `fitPowder` fits the burn coefficient and, on request, `startPressure`, `volumeFactor`, `energy` and `temperatureFactor` (`packages/core/src/interior/fit.ts`, `parameterNames`, `fitPowder`); `predictPowder` gives the band at an unfired charge (same file). `fitPowderSessions` joins sessions at several barrel lengths and temperatures and holds the parameters they do not resolve (`packages/core/src/interior/fit-sessions.ts`). `similarPowdersPrior` takes the five nearest powders of the same burn law and is `weak` below three (`fit-confidence.ts`, `similarPowderRules`: count 5, minimum 3). `powderConfidence` labels the range tight, moderate or loose, with reasons such as `weak-prior` and `no-pressure` (same file). Model page: `apps/docs/docs/models/interior-powder-fit.md`.
- `loadNotes(sessions, roundCountThreshold)` reads the session readings of one load and nothing else (`packages/core/src/load-notes.ts`).
- Sharing: `shareLink` packs the records into the fragment, deflate-raw and base64url, and returns undefined over `maxLinkChars` (8000). `shareProblem` refuses a load whose fields name `user:` records (`apps/web/src/lib/share-link.ts`). A powder record alone can be shared.

## Recommended decisions

| # | Question | Options | Recommendation and reasoning | Cost of being wrong | Default until overruled |
|---|---|---|---|---|---|
| 1 | Provenance of a fitted powder | (a) `provenanceKind` only, as today; (b) references to the sessions; (c) a copy of the ladder in the record | (c). `provenanceKind` stays `fitted`, and one optional block `fit` holds the ladder it was fitted to (charge, mean velocity, shot count, barrel length, temperature, case capacity, bullet mass per point), the parameters freed, the options (prior, loss), the date, the model and its version and the confidence label with its reasons. A copy, so deleting or editing a session does not change what the powder rests on; the session ids are kept for information only and are never resolved. | additive and optional; removing it is free before 1.0, a migration after | one optional `fit` block |
| 2 | Versions on refit | (a) overwrite the record; (b) a version counter or history array in the record; (c) a new record per refit | (c). A refit saves a new powder record named "<name> (fit 2)" whose `fit.previous` names the old one (`user:<id>`). The old record stays, so loads that use it run as before. No counter and no history array: the chain of `previous` is the history. | low | new record per refit |
| 3 | Loads that use the old version | (a) move them to the refit silently; (b) keep them on the old record with a note; (c) ask at refit time | (b). The load keeps its `user:<id>`. The workbench shows "A newer fit of this powder exists" with the action "Use the refit". The rule runs in the web app over the stored powder records, next to `powderDesigns`, not in core `loadNotes`, which reads session readings only; putting it in core would add the user powders as a new input. This covers refits only: an in-place edit of a design keeps changing the loads that use it, as today, and the existing note naming the design stays. | low | as stated |
| 4 | Prior from similar powders | (a) no prior; (b) the chosen record's values; (c) `similarPowdersPrior` | (b) when the user starts from a catalogue or user powder (its parameters are the prior centre), else (c) over the catalogue powders of the same burn law for the burn coefficient. The screen says when the prior is weak (fewer than three neighbours, `weak`) and shows the `powderConfidence` label and reasons. | low | as stated |
| 5 | Sharing | (a) file only; (b) file and share link, refused over the limit; (c) share link that drops `fit.input` to fit | (b). The record shares by file, Export all and a share link. `shareLink` already returns nothing over 8000 characters; the button then says "Too long for a link: save the powder to a file", and nothing is dropped silently. The measurement below shows a typical fit stays far within the limit. A load that uses a user powder keeps today's refusal (`shareProblem`), which names the powder field. | low | as stated |
| 6 | Marks in the workbench and the printed page | (a) one "user design" mark, as today; (b) separate fitted and hand-tuned marks | (b). The fields' mark reads "simulation parameters fitted to 5 strings, 2026-10-28" for a record with `fit`, and "simulation parameters, hand-tuned" when a slider or a typed value moved a fitted parameter after the fit (the record then has `fit` and differs from the fitted values, so no extra flag is stored). The printed page repeats the mark in the powder line. The prediction band stays on screen only. | low | as stated |
| 7 | Temperature sensitivity | (a) in the first slice; (b) a later slice | (b). Strings of one charge at two or more temperatures go to `fitPowderSessions` with `temperatureFactor` requested; core already fits the factor (`fit.ts`, `parameterNames`), so no core extension is needed. Two preconditions the slice must handle: the load must carry a temperature sensitivity other than 0 (`fit.ts`, `checkParameters`), which a user draft may lack, and with one temperature the fit fails as ill-conditioned (`interior-powder-fit.md`, "Several barrel lengths and temperatures"). The record then stores the scaled sensitivities in the draft and the temperatures in `fit.input`. | low | later slice |
| 8 | What a fit may free | (a) every parameter core can fit; (b) only what issues 54 and 227 show identifiable | (b). Until then the ladder fit frees the burn coefficient, and energy only from several barrel lengths; the pressure exponent and the burn-form constants stay fixed inputs (`interior-powder-fit.md`, Limits). Finding: `fittedKeys` in the designer offers `form.a` as fitted. That is right for a value from the pressure-trace curve fit (`interior-curve-fit.md`), never from a ladder; the tuning screen must not offer to free it. | freeing a weakly identified parameter fits noise | fixed |

No row changes with the placement issue 285 picks: they concern the record, the share path and the text, not where the controls sit.

## Stored-shape change (one place)

- File: `packages/schema/src/user-data.ts`, schema `userPowder`.
- Change: one optional field `fit` with `input` (at most 40 points: `charge` g, `muzzleVelocity` m/s, `shots`, `barrelLength` mm, `temperature` degC, `caseCapacity` cm3, `bulletMass` g), `parameters`, `options`, `date`, `model`, `modelVersion`, `confidence` and `reasons`, `sessions` (ids, information only) and `previous` (`user:<id>`). Stored units of `packages/schema/src/units.ts`.
- Nothing else changes shape: no field on the catalogue `powder`, on `load` or on `session`.
- Line for the freeze list of issue 405 (open item "Format freeze beyond the API"): "User powder `fit` block (`userPowder.fit` in `packages/schema/src/user-data.ts`, issue 286): optional, added before the freeze."

## Share link size

The share link of one user powder with a fit block, packed exactly as `shareLink` packs it (JSON of the user data file, deflate-raw through `CompressionStream`, base64url, the `#record=` fragment). The draft is the demo powder record's fields; the page is a 65-character `/next/powders/designer/` address.

| Record | JSON | Link | Within 8000 |
|---|---|---|---|
| Draft only | 808 chars | 683 chars | yes |
| Draft and fit, 5-charge ladder | 1,821 chars | 1,103 chars | yes |
| Draft and fit, 40 irregular points (cap) | 6,191 chars | 1,677 chars | yes |

Even the cap stays below a quarter of the limit, so build draft 4 is only the message for the case `shareLink` already refuses. Node 26.11.1 on the host. Command, with the script below saved as `share-size.mjs`:

```sh
node share-size.mjs packages/data/records/powders/demo-powder-dp40.json https://openreloading.github.io/Ballistics/next/powders/designer/
```

```js
// Length of a share link for one user powder with a proposed `fit` block, packed as shareLink packs it.
import { readFileSync } from 'node:fs'
const [recordPath, page] = process.argv.slice(2)
const { id, manufacturer, provenance, ...draft } = JSON.parse(readFileSync(recordPath, 'utf8'))
const ladder = [2.4, 2.5, 2.6, 2.7, 2.8].map((charge, i) => ({
  charge, muzzleVelocity: 791.4 + 23.7 * i, shots: 5, barrelLength: 610, temperature: 21.5,
  caseCapacity: 3.52, bulletMass: 9.72,
}))
const fit = {
  input: ladder,
  parameters: ['vivacity', 'energy'],
  options: { prior: 'similar', loss: 'huber' },
  date: '2026-10-28',
  model: 'm3',
  modelVersion: '0.0.4',
  confidence: 'moderate',
  reasons: ['no-pressure', 'capacity-estimated'],
  sessions: ['user:6f1c2a9e-3b7d-4e21-9a0c-58d4f2b1e7a3', 'user:0b9e7d14-52aa-4c3f-8e61-7a2d9c4b1f05'],
  previous: 'user:1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
}
const variants = {
  'draft only': { origin: 'user', provenanceKind: 'fitted', draft },
  'draft and fit (5 charges)': { origin: 'user', provenanceKind: 'fitted', draft, fit },
  'draft and fit (40 charges)': {
    origin: 'user', provenanceKind: 'fitted', draft,
    fit: { ...fit, input: Array.from({ length: 40 }, (_, i) => ({ ...ladder[i % 5], charge: 2.0 + i * 0.025, muzzleVelocity: Math.round((700 + i * 4.3 + ((i * 7919) % 97) / 7) * 10) / 10, temperature: Math.round((-5 + ((i * 104729) % 431) / 10) * 10) / 10, barrelLength: [508, 610, 660][i % 3] })) },
  },
}
for (const [label, data] of Object.entries(variants)) {
  const records = [{ kind: 'powder', id: 'a3c9e1f2-7b4d-4e8a-9c1f-2d3e4f5a6b7c', name: 'DP40 (fit 2)', saved: '2026-10-28T09:12:44.000Z', data }]
  const text = JSON.stringify({ format: 'openreloading-user-data', version: 1, records })
  const packed = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
  const b64 = btoa(String.fromCharCode(...packed)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const link = `${page}#record=${b64}`
  console.log(`${label}: JSON ${text.length} chars, link ${link.length} chars, ${link.length <= 8000 ? 'within' : 'over'} 8000`)
}
```

The browser's `CompressionStream` may pick another compression level than Node's; the margin (1,103 against 8,000) covers that.

## Build issue drafts (none opened)

1. `feat(schema)`: the optional `fit` block on `userPowder`, with schema docs and a round-trip test. One pull request; before the freeze of issue 405.
2. `feat(web)`: save from the tuning screen as a user powder with `fit`, and the fitted or hand-tuned marks on screen and on the printed page. After issue 285 and draft 1.
3. `feat(web)`: refit as a new record with `fit.previous`, and the "A newer fit of this powder exists" note with "Use the refit" (web-side rule over the stored powders). After draft 2.
4. `feat(web)`: the message naming the file route when `shareLink` refuses a powder link. Small; after draft 1.
5. `feat(web)`: temperature strings slice through `fitPowderSessions` with `temperatureFactor`, including the zero-sensitivity case. After drafts 1 to 3.

All of issue 27 sits after issue 285 (the screen) and issue 279 (what the docs may claim about a fitted result); drafts 1 and 4 need neither.
