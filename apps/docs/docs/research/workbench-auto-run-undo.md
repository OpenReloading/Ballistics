---
title: Automatic run and undo on the workbench
description: Run times of the workbench in Chromium at CPU throttle 1, 4 and 6, four ways to start a run, the layout shift each gives, and the step rules and shortcut behaviour of an undo history for the load inputs.
---

# Automatic run and undo on the workbench

## Question

Workbench UI: should the load workbench run the simulation by itself once every required input is valid, and should its inputs have undo and redo?

## Method

Decided before the runs, on a throwaway branch with a prototype (`spike/354-auto-run-undo`, commit `4321d13934648619bcb8e374e297dd8b136b27e1`, specs and raw output in `spikes/354/`):

- Run time: the static export (`npm run static:build`) served locally, Chromium of the dev container image at 1280 x 800, the example load applied. The time from the start of a run (the result section gets `data-running`) to the end of the run with "Simulation done." in the result. 20 measured runs per case after one first run (worker start), median and P90 (nearest rank). Cases: the example as it is (a 5-step charge ladder), its charge alone (ladder steps 1) and a 21-step charge ladder of 0.15 gr. CPU throttle 1, 4 and 6 (`Emulation.setCPUThrottlingRate`), a stand-in for a phone, not a phone.
- Main thread: the longest `longtask` entry (over 50 ms) during each run; one key typed into the charge field 20 ms after Run, with its Event Timing input delay and duration.
- Accept rule for an automatic run, from the issue: the plain case well under a second and never blocking input; then for each variant: a half-typed or invalid value never starts a run, several edits in a row give one run, an edit cancels a run in flight, the stale marker shows until the new result, a layout shift of 0, and no result that reads as a recommendation.
- Variants: Run only (today); automatic 600 ms after the last edit once `form.isValid()`, no ladder error and every checklist step is done (`?auto=pause`); the same as a setting, off by default (on, it is the same code; off, it is Run only); automatic for a load without a ladder only (`?auto=plain`). A run in flight is cancelled by the existing `markChanged`. Each variant runs one scenario: type `4x` into the charge, then two edits 400 ms apart, then an edit during a run, then one Run by the key, then one edit measured alone. Layout shift as in `workbench-layout.spec.ts` (the input column), and in addition for the whole page, split by `hadRecentInput` (a shift within 500 ms of an input is excused from the page's layout shift score).
- Undo: a history of the load fields with the existing `editHistory` (a run of edits of one field is one step, a write of several fields at once is one step), bound to the existing `undo` and `redo` shortcuts. A spec checks Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y outside a field and Ctrl+Z inside a focused field.
- Cheaper alternatives: counted against six editing cases (a mistyped value, a wrong record pick, a ladder change, Reset, Example load, opening another load over the current one).

Host: 16 threads, AMD Ryzen 7 7800X3D, shared with other jobs (load average 2 to 8 for the single charge, 21-step and variant runs, 7 to 17 for the example runs).

## Formulas

- Median and P90: the values at rank $\lceil 0.5\,n \rceil$ and $\lceil 0.9\,n \rceil$ of the $n = 20$ sorted run times.
- Layout shift: for each shift, the score is the fraction of the viewport the moved elements cover times the distance they moved as a fraction of the viewport, summed over the shifts of a scenario ([Layout Instability](../bibliography.md#layout-instability)). A long task is a main-thread task over 50 ms ([Long Tasks](../bibliography.md#longtasks)). Input delay is the time from a key event to the start of its handler, duration the time to the next paint ([Event Timing](../bibliography.md#event-timing)).
- CPU throttle $r$: Chromium slows the page's CPU by the factor $r$ ([DevTools Protocol, Emulation](../bibliography.md#cdp-emulation)). Whether this slows the compute worker as much as the main thread is unverified, and likely not: the 21-step ladder at throttle 4 took 1.5 times its time at throttle 1, not 4 times. The throttled run times therefore understate a phone's compute; the long tasks, which are main-thread work, are the part of the stand-in to trust.

## Numbers

Run time, ms, 20 runs each (first run in brackets):

| Load | Throttle | Median | P90 | Longest task, median / max | Key during a run: delay / duration |
| --- | --- | --- | --- | --- | --- |
| Single charge | 1 | 114 (128) | 125 | none / none | 0 / 48 |
| Single charge | 4 | 219 (461) | 247 | 103 / 147 | 26 / 184 |
| Single charge | 6 | 292 (383) | 327 | 154 / 173 | 38 / 232 |
| Example, 5-step ladder | 1 | 266 (267) | 301 | none / none | 6 / 72 |
| Example, 5-step ladder | 4 | 422 (543) | 451 | 138 / 155 | 34 / 216 |
| Example, 5-step ladder | 6 | 581 (686) | 612 | 220 / 244 | 48 / 392 |
| 21-step ladder | 1 | 591 (602) | 605 | none / none | 7 / 64 |
| 21-step ladder | 4 | 884 (914) | 913 | 140 / 170 | 28 / 240 |
| 21-step ladder | 6 | 1056 (1204) | 1362 | 217 / 312 | 49 / 408 |

The key typed during a run cancelled it in every case. The compute runs in a worker; the long tasks are the page's work on the result.

Variants (single charge unless named). Layout shift of the input column, the method of `workbench-layout.spec.ts`: 0 in every variant and every step of the scenario. Page shift of one run: one Run by the key 0.012, of it 0.006 unexcused (21-step ladder 0.037, all unexcused); one automatic run after one edit 0.012, all unexcused. The page shift comes from the result rendering; an automatic run only loses the excuse of a recent input.

| Variant | `4x` typed (the field keeps `4`) | Two edits in a row | Edit during a run | Stale marker | Verdict |
| --- | --- | --- | --- | --- | --- |
| Run only | no run | no run | not applicable | stays until Run | passes, today's behaviour |
| Automatic after a pause | runs with 4 gr after the pause | one run | ladder: cancelled, one run follows; single charge: the run had ended | shown in the pause, cleared by the result | fails the half-typed rule (the retained 4 starts a run); a pause cannot tell a half-typed value from a finished one; blocks input on the phone stand-in |
| Automatic as a setting, off by default | off: as Run only; on: as after a pause | on: one run | on: as after a pause | as after a pause | as after a pause when on |
| Automatic for the plain run only | plain: as after a pause; ladder: no run | plain: one run | plain: the run had ended | plain: cleared; ladder: stays | as after a pause for the plain load, Run only for a ladder |

The automatic run adds no text: its result reads as a Run's, with the same notice. No focus moved in any variant (the charge field kept the focus and the typed value).

Undo prototype: outside a field Ctrl+Z took back the bullet mass, then the charge (one step per field), Ctrl+Shift+Z and Ctrl+Y redid them. In a focused field Ctrl+Z was the browser's text undo (37.05 back to 37.0) and the workbench history did not move; the existing shortcut table already keeps `undo` out of text fields.

## Result

no change. Not adopted; recommendation: keep Run only and build no undo history. Which variant, if any, is built stays open.

- Automatic run: the plain case stays well under a second (the single charge 0.33 s at P90 at throttle 6, the throttled compute understated, see Formulas), and at throttle 1 nothing blocks input (no long task, key delay 0 to 7 ms). The deciding number is the phone stand-in: long tasks of 103 to 173 ms for the single charge at throttle 4 to 6, and a key typed during a run takes 184 to 232 ms to paint, so a run started by a pause would land on the next keystrokes. Of the run rules, all but the half-typed rule pass (one run per burst of edits, cancel on edit, the stale marker until the result, input column shift 0); the half-typed rule fails because a pause cannot tell a half-typed value from a finished one: the prefix `4` of a charge is a valid value and was simulated (true by construction for any pause shorter than the time the user stops). A trigger on leaving the field or Enter is the one form left that avoids that; it was not measured.
- Undo, from the code: Reset, Example load and opening another load over unsaved changes ask "Discard the unsaved changes and start a new record?" (`startNew` and `isUnsaved` of the File menu), a focused field has the browser's text undo (tested), and a saved load can be reopened from Saved loads (a revert to saved, all edits at once). That leaves 2 of the 6 cases without a way back: a wrong record pick and a ladder change, each one field or choice to set again. `offerUndo` on Reset and Example load would add a way back after the confirmation, covering 2 of 6 cases that are already guarded. A full history must snapshot the hook's state, 69 `useState` and 27 `useRef` in `use-workbench-load.ts`: the fields-only prototype undid a bullet pick's mass but not the bullet record.
- Step rules, if a history is built later: one step per field once it is left (the existing `editHistory` merges a later edit of the same field into the step, so leaving a field must end the step), one per record pick with the fields it fills and the seating that follows, one per ladder change (steps, kind, step size, direction), one per Example load and per Reset (so they can be taken back, not a new history), a new history on opening a saved load or a file (as the designers' `start`), one history per open load in the load switcher, kept through Save, gone on reload; a unit switch rewrites the steps (`mapHistory`) and is no step. Every undo marks the result stale.
- Surprises: an automatic run changes the result while the cursor is still in the charge field; the result section's status is in a polite live region, so a screen reader would hear "Simulating" and the result line after each pause in typing (inferred from the region, not heard with a screen reader); an automatic run's page shift counts in the layout shift score where a Run's is half excused; Ctrl+Z in a field and outside it do different things with the same key.

## Data basis

measured: run times, long tasks and layout shifts of the app's static export in Chromium on one desktop host, with CPU throttling as a stand-in for a phone. No phone was measured.

## Where in the app

- `apps/web/src/components/use-workbench-load.ts`: `run`, `send`, `markChanged`, `asNewLoad`.
- `apps/web/src/components/workbench.tsx`: the stale marker, `resultStatus`, the Reset load entry.
- `apps/web/src/components/workbench-results.tsx`: the result section and its `data-running`.
- `apps/web/src/lib/history.ts`: `editHistory`, `pushHistory`, `undo`, `redo`, `mapHistory`.
- `apps/web/src/components/shortcuts.tsx` and `apps/web/src/lib/shortcuts.ts`: `undo` and `redo` kept out of text fields.
- `apps/web/src/components/file-menu.tsx`: `startNew`, the discard question.
- `apps/web/src/components/confirm.tsx`: `offerUndo`.

## Confidence

medium: the variant checks are one scenario each and the run times are from one shared desktop host with throttling, not a phone.
