# #827 prototype: published load rows beside the simulated result

The prototype is behind `?proto=a|b|c` on the workbench, on the branch `prototype/827-published-deviation` (no pull request, not for merge). Without the flag the workbench is unchanged, and the e2e smoke test `apps/e2e/tests/web/proto-827-published.spec.ts` checks both cases. All values shown are simulations, not load data. The printed rows are the maker's values, cited.

**Fixture.** Hodgdon Annual Manual 2025 (https://hodgdonpowderco.com/wp-content/uploads/2026/04/AM25.pdf, retrieved 2026-11-01, SHA-256 in the file), 308 Winchester. Barrel 24", twist 1:12" are on page 115; the 175 GR. SIE HPBT loads with COAL 2.800" are on page 117. Two loads: IMR 4064 (psi, case-contact basis) and Varget (CUP, crusher). Every figure keeps its printed `raw`, and the file parses with `publishedLoads`. Reload Swiss serves its table only inside a minified script bundle, so no `V5` row could be transcribed reliably. A row printed at a distance is therefore shown as "not corrected to the muzzle yet".

**Try it:** `/workbench?proto=c&cartridge=308-win&bullet=<a 175 gr .308 bullet with a length>&powder=imr-4064`. Rows match on cartridge, powder record and printed bullet mass, not on the bullet record. 308 Win. has no capacity record, so type a case capacity before running.

### What each layout shows

Sheets: `sheets/<layout>-<width>-<theme>.png` (the view after the run) and `...-table.png` (scrolled to the rows), at 1280x650 and 390x844, light and dark, for base, a, b and c. They were taken one fix before the branch head, when the header read "2 rows match" instead of "2 matching".

- **a, result tab "Published loads".** At 1280 the tab does not fit the tab row and lands in the More menu, so nothing shows that rows exist. The table fits the result column once its cells wrap; only the "Use this row" button clips by about 20 px. At 390 each row becomes a card (Printed with conditions and source link, Simulated, both deviations, the button) and reads well.
- **b, header row above the notes.** One line: "Published loads: 2 matching", the nearest row to the run's charge with its velocity deviation and source link, and Show rows. The list opens inline and pushes the warnings and tabs down. At 1280 the row fits in two lines. At 390 it sits below the burn-rate figure, a long scroll from the readouts.
- **c, both.** The header row is the signal and Show rows opens the tab. It uses the most room but is the only layout where the rows are visible and the full table has a stable place.

Each deviation shows the signed percent (velocity also in m/s) and the band (velocity P90 7.2 % rifle or 12.5 % handgun, pressure 37.9 % case-contact or 43.7 % C.I.P.). A marker sits on a scale of twice the band. There is no pass mark and no colour for inside the band. Crusher rows show the velocity deviation and "Crusher pressure (CUP, LUP): compared by velocity only".

### Recommendation for the owner to rate

**c**, with a shorter tab label so it fits the row at 1280, and the header row moved above the readouts on a phone. Confidence medium: the sheets show one cartridge with two loads, not a crowded table.

### Open points for the build

1. An API body per cartridge from the published load files (#818 layout); the prototype reads a fixture bundled into the client.
2. The row-to-load mapping: the prototype moves the bullet base and the chamber volume by the bore area times the COAL step (`rowLoad`, a stated shortcut). The build should seat the bullet with `@open-reloading/drawing` at the maker's COAL.
3. Barrel field: the load has no barrel. "Use this row" writes charge, bullet travel and usable case volume, so those fields stop following the seating. The build should set the COAL and the barrel length inputs.
4. The muzzle correction for `V5`/`v3` rows (`muzzleVelocityFromDownrange`, as `packages/cli/src/evaluate.ts` `atMuzzle` does). It needs the bullet's drag in the web app.
5. A missing barrel uses the cartridge's median printed barrel with its interval; the prototype shows it as not comparable.
6. Customer tables (`producedBy: customer`) as their own labelled group; the fixture has none.
7. Seating and temperature ladders show no rows: their step's travel and volume are not the seating the rows move from.
8. In-sample mark: computed from the cartridge's split, as `splitOf` does. 308 Win. is in the validation split, so the sheets show no mark.
