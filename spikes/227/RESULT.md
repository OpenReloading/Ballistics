Branch `spike/227-curve-fit-exponent` (script, tables, raw cells under `spikes/227/`, research log entry `apps/docs/docs/research/interior-curve-fit-exponent.md`), no pull request. Results are simulations, not load data.

## Spike #227: resolving the pressure exponent of the curve fit

Decision: fit two or more traces of the same powder lot, rifle and sensor at different charges together, with one fitted time shift per trace, and raise the exponent's variance inflation limit to 100 for that joint fit. One trace keeps the limit 10, so its exponent stays held. Do not fix the time shift from a sensor delay, and do not add muzzle velocity or exit-time rows. The exponent's uncertainty covers the noise only: report it as such, widen its interval, and check for model error.

### Method

Script: `spikes/227/exponent.mts`. Run: `node spikes/227/exponent.mts --reps 50 --part <p>/4 --out spikes/227/out`, then `--summarise` for `spikes/227/tables.md`. `--check` compares the single-trace case with `fitPressureCurve`.

- Synthetic breech traces of the load of the curve fit page (0.6 m barrel, 6.9 mm bore, two-stage form a 0.8, z1 0.3). Samples every 10 us on a clock with a random offset of 0.2 to 0.4 ms. Gaussian noise of a fixed fraction of the peak. The true burn coefficient is scaled with the exponent so that every truth has the same burn rate at 130 MPa: at exponent 0.8 the peaks stay at 84 to 124 MPa and do not collapse.
- Start values: burn coefficient 3 % off, form 5 % off, exponent 20 % above the truth.
- Joint fit: burn coefficient (stated at the geometric mean of the peaks), a, z1 and exponent shared, one time shift per trace. The window and the hold rule for an unresolved form parameter are those of `fitPressureCurve`. With one trace it reproduces `fitPressureCurve` to the printed digits on 6 seeds. The condition limit is relaxed in the run, and every limit is applied afterwards on the recorded values.
- Grid, 50 replicates per cell. Seeds: 1000 (r + 1) + 16 k for replicate r and trace k, the same traces in every mode of a cell.
  - Q1, several traces: K = 1, 2, 3, 5 traces at charges evenly spaced from 2.4 to 3.0 g (one trace: 2.8 g; highest peak 1.3 to 1.5 times the lowest). Exponent 0.3, 0.5, 0.8. Noise 0.1, 0.5, 2 % of the peak. Time shift fitted. Two traces from 2.6 and 2.8 g to 3.0 g (highest peak 1.2 to 1.3 and 1.1 to 1.14 times the lowest), noise 0.5 %.
  - Q2, time shift: K = 1 and 3, noise 0.5 %. The shift is fixed at the truth plus a common delay error of 0, 2, 5 or 10 us, or fitted with one muzzle velocity per trace (sigma 3 m/s) or one muzzle-exit time on the trace clock (sigma 5 us).
  - Model error: the truth has convective heat loss (2800 K, factor 0.5) and bore friction (2.5 MPa) that the fit lacks. Exponent 0.5, K = 1, 3, 5, shift fitted or known.
- Fitted means converged, variance inflation and condition number below the limit, and relative uncertainty below 0.25. Coverage is the share of runs whose truth lies inside the 90 % interval (1.645 u on the log exponent). The factor is what u would need for 90 %. 50 replicates give about 4 points of standard error near 90 %.

### Results (noise 0.5 %; all cells in `spikes/227/tables.md`)

| traces | exponent | VIF | fitted at 10 | fitted at 100 | u_rel | coverage | factor |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0.3 | 141 | 0 % | 6 % | 0.037 | 86 % | 1.89 |
| 1 | 0.5 | 160 | 0 % | 0 % | 0.018 | 83 % | 1.87 |
| 1 | 0.8 | 350 | 0 % | 4 % | 0.011 | 92 % | 1.47 |
| 2 | 0.5 | 39 | 0 % | 98 % | 0.006 | 86 % | 1.92 |
| 3 | 0.3 | 45 | 4 % | 98 % | 0.010 | 82 % | 3.00 |
| 3 | 0.5 | 51 | 0 % | 100 % | 0.006 | 90 % | 1.71 |
| 3 | 0.8 | 61 | 2 % | 100 % | 0.003 | 84 % | 2.00 |
| 5 | 0.5 | 60 | 0 % | 100 % | 0.005 | 82 % | 2.26 |

**Several traces resolve the exponent, and two are enough.** Across all noise levels and exponents, one trace gives a variance inflation of 125 to 365 and is fitted at the limit 100 in 0 to 22 % of runs. Two or more traces give 17 to 68 and are fitted at the limit 100 in 90 to 100 % of runs; the rest are fits that did not converge, up to 5 of 50 at 2 % noise. The relative uncertainty falls by a factor of 2 to 5. Three and five traces add little over two. The peak spread matters: two traces with the highest peak 1.2 to 1.3 times the lowest (2.6 to 3.0 g) give 63 to 83 and are fitted at 100 in 98 to 100 %; at 1.1 to 1.14 (2.8 to 3.0 g) they give 100 to 194 and are fitted in 0 to 46 %. At the default limit 10, the exponent is still almost never fitted, with or without several traces.

**A known time shift needs a delay known to well under 2 us.** Fixing the shift cuts the variance inflation to 7 to 12, but a common delay error biases the exponent by more than its uncertainty:

| delay error | 0 | 2 us | 5 us | 10 us |
| --- | ---: | ---: | ---: | ---: |
| 3 traces, n 0.5: fitted / true | 1.000 | 0.991 | 0.979 | 0.957 |
| 3 traces, n 0.5: coverage | 78 % | 0 % | 0 % | 0 % |
| 1 trace, n 0.3: fitted / true | 0.997 | 0.973 | 0.936 | 0.866 |

The form slope moves too: one trace gives 1.035 to 1.065 of the truth at 2 to 5 us and up to 1.243 at 10 us; the burn coefficient stays within 1 to 2 %. The model's time zero is the start of the M3 run, which no recorder marks, so this delay is not known to that accuracy in practice.

**A second signal does not help.** With one muzzle velocity or one muzzle-exit time per trace, one trace still gives a variance inflation of 143 to 350 (141 to 350 without; the exit time lowers it to 210 at exponent 0.8, still above 100), and a few more fits fail. A velocity constrains the burn, not the clock, and a 5 us exit time is weaker than the trace itself.

**The stated uncertainty is too small.**
- Without model error, coverage is 70 to 100 % over the cells with fitted shifts. The factor for 90 % is 1.4 to 3.6, median about 2.2, instead of 1.645. A transition point held at its 5 % wrong start value adds to this.
- With heat loss and bore friction in the truth, the fitted exponent is 1.068 of the truth with one trace and 0.981 to 0.982 with three or five traces, at u_rel 0.006 to 0.018. Coverage is 8 to 22 %, while chi2 per degree of freedom stays at 1.04 to 1.14, so the residuals do not show the error. With the shift known, the exponent is 1.03 of the truth and coverage is 0 to 4 %. The form slope absorbs most of the missing physics (0.23 to 0.81 of the truth), so a fitted form is not a powder property either.

**Why this differs from the single-trace study in #225** (never fitted at 0.8 with limit 500): here the truth's burn coefficient is scaled with the exponent, so the peaks at 0.8 stay at 84 to 124 MPa instead of collapsing; the exponent starts 20 % off instead of at the truth; and only 10 us sampling is used. At the default limit 10 both agree: one trace is fitted in 0 to 4 % of runs.

### Decision and reasons

- **Approach:** a joint fit of two or more traces with fitted time shifts. It is the only option that resolved the exponent at all three exponents without a bias above its uncertainty when there is no model error. It is adopted in a reduced form: its interval under-covers (11 of 27 cells cover 70 to 78 %), and under model error it is 2 to 7 % off at a relative uncertainty below 2 %.
- **Limits:** variance inflation 100 for the exponent in the joint fit. It fits 90 to 100 % of runs with two or more traces, and only up to 22 % of single-trace runs. One trace keeps 10. The condition limit 1e3 never decided a several-traces cell: their median condition number is 10 to 17.
- **What the user must provide:** at least two traces of the same powder lot, rifle, sensor and sensor position, at charges whose highest peak is at least about 1.2 times the lowest (1.2 to 1.5 worked, 1.1 to 1.14 did not). A sensor delay, a muzzle velocity or an exit time is not needed.
- **Uncertainty and interface:** the exponent is reported with the statement that its uncertainty covers trace noise only. Proposed, untested: a wider interval (a factor of about 2.5 instead of 1.645 reached 90 % in 23 of 27 noise-only cells; the model-error cells need 4.6 to 5.9), and with three or more traces a leave-one-trace-out spread as a check for model error. #566 derives the factor and tests the check. No interface uses the curve fit yet, so this goes into the library result and the model page.

### Not tested

Real traces (sensor resonance, the shot-start kink, gain error), other sample steps than 10 us, a wider charge spread, a peak ratio between 1.14 and 1.2, the leave-one-trace-out check itself (#566), and a wrong exponent start value further than 20 % off.

### Build issues

- #565 Joint curve fit of several pressure traces of one powder (the approach, the limit 100, the peak-ratio check).
- #566 Honest uncertainty of the fitted pressure exponent (the noise-only statement, a derived coverage factor, the leave-one-trace-out check).
