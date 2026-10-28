# Powder tuning screen: prototype finding (#285)

Throwaway prototype on synthetic ladders from the core model, never merged. Every value below is a simulation on invented strings, not load data. The model is the real `fitPowder`, `predictPowder`, `powderPressureRange` and `powderConfidence` of `@open-reloading/core`.

## Run it

```sh
npm run build && npm run dev:static     # then open http://localhost:3000/powders/tune/
node apps/web/scripts/powder-tune-proto-measure.mts                              # Node measurements, after build
WEB_URL=http://localhost:3003 node apps/e2e/scripts/powder-tune-proto-browser.mts  # browser measurements and screenshots, against `npm run static:build` and `npm run pages:serve`
```

Files: route `apps/web/src/app/powders/tune/`, screen `apps/web/src/components/powder-tune-proto.tsx`, ladders, texts and the call into core `apps/web/src/lib/powder-tune-proto.ts`, worker `apps/web/src/lib/powder-tune-proto.worker.ts`. Screenshots at 1280 x 650 and 390 x 844 (full page) are in `shots/`, one per ladder (`<ladder>-desktop.png`, `<ladder>-phone.png`), plus `hand-tuned-desktop.png` and the workbench for comparison.

## Pick

| Question | Pick | Case that decided |
|---|---|---|
| Where the screen lives | Own route `/powders/tune`, opened from the Measurements tab and the powder designer | Budget: the screen's own chunk is 9.9 kB gzip, the workbench has 5.8 kB left (995.2 of 1001.0 kB total), so a workbench panel fails the route budget. Height: the workbench result area at 1280 x 650 is 578 x 586 px, the screen needs about 685 px high in two columns (one slider, one parameter) and more in one column. A Database tab stays rejected (no strings there). |
| Data entry | Preloaded strings plus "Add a string" (charge, shot velocities); mean, SD and count per charge | Two fields per added string. Works as built. |
| Refusals | One sentence per core reason, plus one more (held values, below) | Texts below. |
| Thin data | Fewer than 3 charges or under 10 % spread: warn, fit the burn coefficient alone, offer "Try the other values anyway" | See "Thin data". |
| Uncertainty | As specified, plus numbers at the ends of the drawn range | The band is a hairline on the chart (see below). |
| Hand tuning | Sliders for the fitted values, range 3 standard uncertainties, rerun in the worker | 47.6 ms median per move in the browser, no debounce needed. |

## Measurements

Machine: dev container on a shared 16-core host, other builds running. Treat times as upper bounds of an idle machine.

| Measure | Result |
|---|---|
| Fit equals `fitPowder` | Good ladder: fitted burn coefficient, its standard uncertainty and every residual are identical (strict equality, Node). In the browser the table shows the same 3 digits (0.449, 0.001). |
| Round trip, truth 0.45 1/s | Good (5 charges): 0.44947 +/- 0.00061, truth at -0.87 sigma, inside 2 sigma. Thin (2 charges): 0.45016 +/- 0.00084, +0.20 sigma, inside. Velocity only, start pressure asked and held: 0.44996 +/- 0.00046, -0.09 sigma, inside. |
| Coverage of 2 sigma over 200 seeds | 5 charges 92.5 %, 3 close charges 90.0 %, 2 charges 89.5 %, 1 charge 87.0 % (nominal 95.4 %). No fit failed. Weighting each string by its own sample SD gave 79.7 %, 84.0 % and 89.3 % (300 seeds, 5, 2 and 1 charge) and is replaced by the pooled SD of all shots. |
| Slider redraw | Compute alone, 25 charges, Node: median 47.0 ms, p95 51.7 ms, max 55.8 ms. In the browser, from key press to the frame after the new curve: 60 moves, median 47.6 ms, p95 56.8 ms, max 58.8 ms. Accepted (100 ms or less). |
| Time in the worker, one burn coefficient | Fit 59 to 175 ms, band over 25 charges about 142 ms, pressure range 308 to 843 ms. A fit with an extra value that is then held runs the fit twice (546 ms). A refused three-value fit takes about 700 ms. |
| Route weight (`check-weight`, gzip 9) | `/powders/tune`: initial 418.3 kB, total 475.6 kB. Not in a group of `weight-budget.json`, so the check fails by design on this branch; it would join "designers" (419.0 / 648.0 kB). Other routes already read 8.4 kB above their recorded values on this base (cause not checked). |
| Layout 1280 x 650 | Two columns. Page scroll with a full result 35 px (good, thin), 16 px (velocity only), 0 px for the refusal ladders. No scroll region inside the page, no horizontal scroll. |
| Layout 390 x 844 | One column, no horizontal scroll. Page scroll 335 to 449 px with a result, 0 to 38 px with a refusal. Own route, so page scroll is allowed. |
| Keyboard order | Skip link, shell navigation, ladder select, charge, velocities, Add a string, slider. The slider thumb had no accessible name in the measured build; the source now sets `thumbLabel` (not re-measured). |

## Refusals on the synthetic cases

| Reason | Ladder (menu name) | Natural or forced |
|---|---|---|
| `underdetermined` | Two charges, three values | Needs the thin rule off: with it on, the screen fits one value and the reason cannot occur. Shown with "Try the other values anyway". |
| `unresolved` | Specific energy from one barrel | Natural, always on a one-barrel ladder. |
| `ill-conditioned` | Three charges 10 % apart, three values | Natural, but noise decides: seeds 16 and 21 refuse, seed 5 fits; with 2.98 g instead of 2.97 g as the top charge seeds 16 and 21 end `not-converged`. |
| `invalid` | A 3.5 g string in a 3.4 cm3 case | Natural. The string is highlighted. |
| `not-converged` | Three close charges, two values | The fit needs 34 steps against the limit of 30, so it refuses in Node but converged in Chromium on the first browser run: not stable across platforms. The ladder sets a limit of 10 so the sentence shows everywhere. No start value between 0.05 and 5 1/s (truth 0.45) failed to converge. |
| held (screen only) | Velocity only, start pressure asked | The core returns a fit without refusal: start pressure 24.0 +/- 5.4 MPa (truth 30), correlation with the burn coefficient -0.997, condition number 26 (the core's limit is 1000), burn coefficient uncertainty 13 times that of the burn coefficient alone. The chamber volume factor behaves alike (correlation 0.986). The screen holds every extra value whose correlation with the burn coefficient exceeds `powderConfidenceRules.correlation` (0.9), refits the burn coefficient alone and says so. |

The thin rule is a weak guard for a second value: 5 charges over 17 % still cannot separate the start pressure on velocities alone, and 3 charges at 10 % sometimes can. The held rule is the reliable test; keep the thin rule as the cheap early warning.

## Texts (screen only)

Refusals:

- underdetermined: "There are fewer charges than values to fit. Add a string at another charge, or fit the burn coefficient alone."
- unresolved: "These strings cannot tell one of the values apart from the burn coefficient. Widen the charge spread, add a measured pressure, or fit the burn coefficient alone."
- ill-conditioned: "The charges are too close to separate the values you asked for. Add a string at a charge well apart from the others, or add a measured pressure."
- invalid: "The model cannot run one of the charges. Check the charge of the highlighted string against the case and the bullet."
- not-converged: "The fit did not settle. Start from the burn coefficient of a similar powder, or fit fewer values."

Warnings and labels:

- Thin data: "Fewer than 3 charges, or charges less than 10 % apart: only the burn coefficient is fitted, the other values stay at those of the similar powder."
- Held values: "These strings cannot tell the start pressure or the chamber volume from the burn coefficient: they move together. They stay at their start values and only the burn coefficient is fitted. Add a measured pressure to fit more."
- Band: "Band: uncertainty of the fitted parameters only, not model error. Simulation, not load data."
- Hand tuning: "Hand-tuned values are yours, not a fit. Simulation, not load data." with a "Hand-tuned" mark.
- Footer of the screen: "All values on this screen are simulations, not load data."

The band line and the confidence label match `apps/docs/docs/models/interior-powder-fit.md` ("Prediction at a charge", "Confidence label": parameter uncertainty only, no model error).

## Other findings

- Weighting: with the SD of each 5-shot string as its weight the 2 sigma interval held the truth in 80 % of 300 seeds. The pooled SD of all shots about their string means gives 92 to 93 %. Use the pooled SD over the root of the shot count as `velocitySigma`.
- Band size: the parameter band is +/- 0.8 m/s at 2.8 g while one string spreads 4 m/s, so it draws as a line. The screen writes the band at the ends of the drawn range as numbers, with "below", "inside" or "above the ladder" from the fit's domain.
- Slowest part: the pressure range (refits per fixed input) is 308 to 843 ms of a 0.5 to 1.2 s answer. Show the fit first and the range and label when they arrive.
- Confidence reasons: the good ladder shows "residuals show a trend" although its noise is random. With five rows, 10 of the 32 sign patterns have at most one sign change, so noise passes that test about 31 % of the time before the chi-square condition (computed, rate of the full rule not measured). The text needs "may" or the rule needs more rows.
- Not covered: strings at other barrel lengths or temperatures (`fitPowderSessions`), measured pressures (the screen takes none yet), the similar-powder prior (`similarPowdersPrior`), saving.

## For #286

- Saving takes the burn coefficient (vivacity of the same burn law) into the powder. Start pressure and chamber volume factor are load and case values, not powder values, and are held on a velocity-only ladder anyway. Specific energy needs ladders at several barrel lengths (`unresolved` otherwise).
- A saved fit should carry the fit's `domain` (charge, velocity, barrel length range), the standard uncertainty of each fitted value, the start powder, the fitted-or-hand-tuned mark and the model page's wording that the values hold for one rifle, lot and component set.
- Versions: the fit result depends on the core model version and the pooled-SD weighting; store both with the record, as the answer to "which model made this".

## Build issue drafts

Each one pull request.

1. **Powder tuning route and entry points.** `/powders/tune`, "Fit a powder from these strings" on the Measurements tab (strings of the open load preloaded), a link in the powder designer, "Add a string". Acceptance: from a load with chronograph strings the route lists them with mean, SD and count per charge; added strings appear in the table; the route is in a group of `weight-budget.json`; no horizontal scroll at 390 and 1280 px (e2e).
2. **Fit in a worker with progressive results.** `fitPowder`, `predictPowder` and `powderPressureRange` in a worker, fit and band first, range and label later, a new edit cancels the running one. Acceptance: Vitest compares the worker's fit with `fitPowder` on the same inputs (strict equality); an edit during a run shows only the last answer.
3. **Weighting of string means.** Pooled SD over the root of the shot count as `velocitySigma`, in a shared helper. Acceptance: a Vitest case over 200 seeds keeps the 2 sigma interval around the truth in at least 90 % of the 5-charge synthetic ladders.
4. **Result view.** Parameters with intervals, residual per charge, the curve and band with the ladder's range marked, band numbers at the ends, label and reasons in plain words, the band line. Acceptance: every text above matches this finding; Vitest checks the strings; axe passes on the route.
5. **Refusals and warnings.** The five sentences, the thin rule, the held rule (correlation above 0.9), "Try the other values anyway", the string at fault highlighted for `invalid`, German texts in the catalogue. Acceptance: a Vitest table runs the synthetic ladders of this prototype and expects each reason and the held case; `npm run i18n` reports no missing key.
6. **Hand tuning.** Sliders for the fitted values (3 standard uncertainties), reruns in the worker, "Hand-tuned" mark, "Back to the fit", slider names for assistive technology. Acceptance: a browser test moves a slider 30 times and the median redraw is at most 100 ms; the curve equals `interior` at the slider values; saving (#286) stores the hand-tuned mark.
