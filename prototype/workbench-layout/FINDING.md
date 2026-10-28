# Workbench input layout: which inputs stay visible (#296)

Throwaway branch `prototype/workbench-layout`, never merged, no pull request. Fake data only: no record, no model run.

## Pick

**Variant D with the pinned row above both input columns (D-top)**: the shipped cards, plus one row of three selects (Primer, Brass record, Case capacity record) across the top of the inputs. It is the only variant that shows all 25 load inputs at 1280 x 650 with zero page scroll, zero inputs-column scroll, zero cut controls, zero layout shift of the inputs while the charge is typed, and keyboard order equal to visual order (rule 5 below). The owner may overrule the pick; build issues use D-top meanwhile.

The hypothesis of the refined spec holds in this form: D wins because the tabs of B hide 9 of the 25 inputs at 1280 x 650. D with the three selects as rows inside the Cartridge card (the first reading of "pinned row") fails: the inputs column scrolls by 17 px at 1280 x 650, as the figure cannot shrink below its 10rem minimum.

## Variants

```
A, C from 48em (shipped)     B (group tabs)                D-top (pick)
+--------+--------+-------+  +----------+---------------+  +-----------------+-------+
|Cartrid.|Powder  |       |  |[Ctg+gun][Proj][Prop]|    |  | Primer|Brass|Cap|       |
| ...    |Bullet  |results|  | one group's cards  |results| +--------+--------+results|
|figure  |Gun     |       |  | (scrolls 36 px)    |       | |Cartrid.|Powder  |       |
+--------+--------+-------+  +----------+---------------+  | figure |Bullet,Gun|      |
More: primer, brass, cap.                                  +--------+--------+-------+

Below 48em: A, D, D-top one flow of cards; B and C the three group tabs inside the Load tab.
D (rows in the card): the three selects as 28 px rows at the top of the Cartridge card.
```

Rendered on one route of the export: `/prototype-workbench/?v=A|B|C|D` (`&pin=top` for D-top, `&long=1` for every label 30 percent longer). The cards reuse the shipped classes, `NumberField`, `SegmentedRow`, `PageBar` and `Workspace`, so the shipped frame, breakpoints and 28 px rows apply. Screenshots in `screens/` (`<variant>-<size>.png` the window, `-long` and `-spacing` at 1280 x 650, `shipped-<size>.png` the shipped workbench with the example run; light theme). Raw numbers: `measurements.json`.

One command, in the dev container after `npm run build`:

```
npm run static:build && PORT=3197 npm run pages:serve &
cd apps/e2e && WEB_URL=http://localhost:3197 node scripts/workbench-layout-measure.mts
```

## Calibration against the shipped workbench

Shipped `/workbench` with the example run, against fake A, same export, same Chromium:

| | Shipped | Fake A |
|---|---|---|
| Column 1 bottom, 1280 x 650 / 1366 x 657 (px) | 642 / 649 | 642 / 649 |
| Column 2 bottom, both sizes (px) | 570 | 570 |
| Inputs shown at 1280 x 650 | 23 | 22 |
| Page scroll and inputs-column scroll at 1280 x 650 | 0 / 0 | 0 / 0 |
| Keyboard stops in the inputs, inversions | 42, 0 | 39, 0 |
| Taps to primer, brass, capacity | 1, 1, none (no capacity record for the example cartridge, so `CapacityChoice` renders no select) | 1, 1, 1 |

The fake Powder card carries the example's 5-step ladder (kind and direction rows) and no bulk density row, as the example powder has none. Off at 390 px: the shipped figure is 475 px high there, the fake one 115 px, so phone heights below the figure are not comparable to shipped; the counts of inputs and taps are.

## Measurements

Chromium in the dev container, served sample export. "Cut" counts the controls of `web/cut.ts` (the check of `workbench-no-scroll.spec.ts`) less record names in a select, which may end in an ellipsis (`apps/web/AGENTS.md`, Ellipsis). Layout shift: every entry while the charge is typed 2.4, then 60, then 9 (the fake readouts change width), split by whether the shifted node is in the inputs; `hadRecentInput` entries count too.

### 1280 x 650 (1366 x 657 in brackets where it differs)

| Rule | A | B | C | D (rows in card) | D-top |
|---|---|---|---|---|---|
| Page scroll (px) | 0 | 0 | 0 | 0 | 0 |
| Inputs-column scroll (px) | 0 | 36 (29) | 0 | 17 (10) | 0 |
| Cut controls | 0 | 0 | 0 | 0 | 0 |
| Record names ellipsized | 2 | 3 | 2 | 5 | 4 |
| Inputs visible without a tap (of all) | 22 of 22 | 14 of 25 (15) | 22 of 22 | 25 of 25 | 25 of 25 |
| Taps to primer, brass, capacity | 1, 1, 1 | 0, 0, 0 | 1, 1, 1 | 0, 0, 0 | 0, 0, 0 |
| Taps to the charge | 0 | 1 | 0 | 0 | 0 |
| Layout shift of the inputs while editing | 0 | 0 | 0 | 0 | 0 |
| Largest move of an input while editing (px) | 0 | 0 | 0 | 0 | 0 |
| Layout shift in the results (fake readouts), two runs | 0.0013 to 0.0019 | 0.0015 to 0.0025 | 0.0013 to 0.0019 | 0.0019 | 0.0013 to 0.0019 |
| Keyboard stops, inversions against visual order | 39, 0 | 27, 0 | 39, 0 | 42, 0 | 42, 0 |
| Accessibility tree order = keyboard order | yes | yes | yes | yes | yes |
| Labels 30 % longer: page / column scroll, cut | 0 / 0, 0 | 0 / 73 (66), 0 | 0 / 0, 0 | 0 / 48 (41), 0 | 0 / 28 (21), 0 |
| WCAG 1.4.12 text spacing: page / column scroll, cut | 0 / 0, 0 | 0 / 73 (66), 0 | 0 / 0, 0 | 0 / 52 (45), 0 | 0 / 45 (38), 0 |

The results shift comes from the fake readouts, whose numbers have no fixed width (the shipped tiles were not measured for this); it is the same order for every variant and not an effect of the input layout. Text spacing allows the inputs column to scroll (`text-spacing.spec.ts`), so a column scroll there is no failure.

### 390 x 844

The shipped phone layout scrolls the inputs column above the readout bar and the page (shipped: page 593 px, column 1182 px with its taller figure).

| Rule | A | B | C | D | D-top |
|---|---|---|---|---|---|
| Page scroll down / across (px) | 104 / 0 | 0 / 0 | 0 / 0 | 236 / 0 | 189 / 0 |
| Inputs-column scroll (px) | 788 | 307 | 307 | 920 | 873 |
| Cut controls | 0 | 0 | 0 | 0 | 0 |
| Inputs shown / in the window without a tap | 22 / 9 | 16 / 11 | 16 / 11 | 25 / 11 | 25 / 11 |
| Taps to primer, brass, capacity | 1, 1, 1 | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| Taps to the charge | 0 | 1 | 1 | 0 | 0 |
| Layout shift of the inputs while editing | 0 | 0 | 0 | 0 | 0 |
| Keyboard inversions, tree order = keyboard | 0, yes | 0, yes | 0, yes | 0, yes | 0, yes |
| Labels 30 % longer: page scroll across, cut | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| Text spacing: cut | the prototype's h1 | same | same | same | same |

The h1 "Workbench layout X (prototype)" is the prototype's own title in the phone top bar (`PageBar`); the shipped title has the same open finding (A-11 of the accessibility page).

Not measured: dark theme, the real German catalogue (the 30 % padding stands in), axe, a screen reader (the tree order is read from Chromium's accessibility tree), touch.

## Rule applied

Rule 5 of the refined spec, at 1280 x 650: the most always-visible inputs among the variants with zero page scroll, zero cut controls and zero layout shift, and keyboard order equal to visual order.

1. Zero page scroll: all pass.
2. Zero inputs-column scroll (the no-scroll rule of `apps/web/AGENTS.md`): A, C, D-top pass; B (36 px) and D (17 px) fail.
3. Zero cut controls and zero layout shift of the inputs: A, C, D-top pass.
4. Keyboard order equals visual order: A, C, D-top pass.
5. Most inputs visible without a tap: D-top 25 against 22 for A and C. D-top is picked; no tie.

## Reading order of the pick (D-top)

Keyboard and accessibility tree, the same order at 1280 and 390 px:

1. Primer, Brass record, Case capacity record (the pinned row, left to right).
2. Cartridge: search, More of Cartridge, usable case volume, bore diameter, bore area, case capacity (H₂O), seat by COAL or CBTO, the COAL or CBTO field, the slider.
3. Powder: search, More of Powder, charge mass, powder temperature, ladder steps, step size, ladder kind, direction, Model parameters Show.
4. Bullet: search, More of Bullet, bullet mass.
5. Gun: firearm, bullet travel, twist, barrel length, gun weight.
6. Run (the run bar below 75em), then the results.

Each field's unit switch follows its field. A screen reader hears the three choices before the cartridge although their lists depend on it (`GET /cases?cartridge=`). Build issue 1 states the fix to measure: the cartridge search moves into the pinned row as its first select, so the row reads Cartridge, Primer, Brass record, Case capacity record.

## Design pass

What stays in view while an input is edited, per variant (the readouts are the shipped ones in all variants: the three key tiles large, the other values as a quiet two-column list, the band line, the ladder steps as one row of chips).

- **A (shipped)**: tiles large (peak pressure with its share of the limit, muzzle velocity, energy), the list quiet. Primer, brass and capacity are invisible, so the volume's source is not on screen. The figure gets 240 px.
- **B (group tabs)**: the results gain 24rem of width, which the tiles do not need; the tile row stays one line either way. Editing the charge needs the Propellant tab, which hides the cartridge values the charge depends on. The Cartridge and gun tab scrolls by 36 px, so a tab is not one screen either. Ladder chips under the results are already the shipped ladder strip.
- **C (tabs below 48em)**: at 390 px the group tabs shorten the Load tab from 788 to 307 px of column scroll and end the page scroll, but cost a tap to the charge, the input changed most. From 48em it is A.
- **D (rows in the card)**: three more 28 px rows in the Cartridge card; "Case capacity record" wraps to two lines in the 288 px card. The figure shrinks to its 160 px minimum and the column scrolls.
- **D-top (pick)**: the row has the labels above the selects (61 px high in all), aligned to the two card columns' left and right edges; record names get about 190 px each: the brass name shows in full, the primer and capacity names lose their last characters to the ellipsis. The figure keeps 179 px. Proposals for the build: a 28 px row with labels beside the selects if the German labels fit (it would give back about 30 px, the margin the long-label pass lacks); the cartridge search as the row's first select (reading order above).

Grouping and alignment kept from the shipped cards: label left, value right-aligned, unit in its own column, one 28 px row per value.

## Answers

| Question | Answer |
|---|---|
| Chosen variant | D-top: shipped cards plus a pinned row above both columns |
| Always-visible set | cartridge, usable case volume, bore diameter, measured case capacity, brass record, case capacity record, primer, powder, charge mass, bullet, bullet mass, barrel length |
| One tap away | seating (seat by, COAL or CBTO, slider: in view from 75em, behind the scroll below), powder temperature, ladder inputs, firearm, bullet travel, twist, gun weight, lots (Notes tab) |
| Rare | bore area, model parameters, bore resistance (Powder More), Bullets of all diameters, the result-tab inputs |
| Small screens | the cards in one flow as today (D-top); group tabs (C) are the alternative if the phone page scroll is to go |

## Inventory

Every input of the workbench on `main` (`apps/web/src/components/workbench-inputs.tsx`, the seating controls of `seating-preview.tsx` in its slots, `primer-choice.tsx`, `load-notes.tsx`, the result tabs). Class: **V** always visible, **T** one tap away, **R** rare.

| Group | Input | Now | Class | Reason |
|---|---|---|---|---|
| Cartridge | Cartridge search | card head | V | the load starts with it |
| Cartridge | Usable case volume | card | V | drives pressure first |
| Cartridge | Bore diameter | card | V | filled from the record, but a wrong value changes everything |
| Cartridge | Bore area | card | R | optional, the record gives it |
| Cartridge | Case capacity (H₂O), measured | card (seating slot) | V | the measured capacity is the strongest volume input |
| Cartridge | Seat by COAL or CBTO | card (seating slot) | T | chosen once per load |
| Cartridge | COAL or CBTO field and slider | card (seating slot) | T | **seating**: set once per load and in a seating ladder; the figure shows its effect, so one tap is enough (it is in view from 75em in every variant but B) |
| Cartridge | Brass record (catalogue product or own brass group) | More | V | **brass**: picks the case and, without a capacity record or measured value, the volume; hidden today, so the volume's source is not on screen |
| Cartridge | Case capacity record | More | V | **capacity**: decides the volume when no measured value is typed |
| Cartridge | Primer | More | V | **primer**: part of every saved load and of the printed sheet, one select |
| Cartridge | COAL, CIP maximum L6; seating notes and values (case volume to the mouth, travel, leade, jump) | More | R | values, not inputs; stay in More |
| Powder | Powder search | card head | V | the load's propellant |
| Powder | Charge mass | card | V | the value changed most |
| Powder | Powder temperature | card | T | **temperature**: a condition set per session; the results line names it |
| Powder | Ladder steps and step size | card | T | for a ladder only |
| Powder | Ladder kind (Charge, Seating, Temperature) | card | T | as above |
| Powder | Ladder direction | card | T | as above |
| Powder | Model parameters (14 values behind Show) | card, collapsed | R | expert values; an invalid one opens the group |
| Powder | Leak area, bore friction, engraving pressure, engraving length | More | R | bore resistance, expert values |
| Bullet | Bullet search and its search dialog | card head | V | the load's projectile |
| Bullet | Bullet mass | card | V | filled from the record, changes pressure directly |
| Bullet | Bullets of all diameters | More | R | a search filter |
| Gun | Firearm from your library | card head | T | **firearm detail**: fills travel, twist, barrel and lands; chosen once |
| Gun | Barrel length | card (seating slot) | V | changes velocity directly |
| Gun | Bullet travel | card | T | follows barrel length and seating |
| Gun | Twist | card | T | stability only |
| Gun | Gun weight | card | T | feeds free recoil only |
| Notes tab | Powder lot, primer lot, brass lot | result tab Notes | T | **lots**: per session, needed when a lot changes; one tap, a picker slot later (#25) |
| Notes tab | Notes | result tab Notes | R | free text |
| Results | Ladder step chips | results | V | the step shown |
| Trajectory tab | Range step, largest range, zero range, sight height, air, wind, drag model and factor, firearm and sight, bullet | tab | R | exterior inputs of their own view |
| Trajectory tab | Truing rows | tab | R | expert |
| Measurements tab | Chronograph files and their mapping | tab | R | per session |
| Ladder table tab | Lot burn rate change, target barrel time | tab | R | ladder analysis |
| Barrel length tab | From, to, step, values from | tab | R | a study, not the load |
| Powders tab | Target peak pressure, powders | tab | R | a study, not the load |
| Chart tab | Playback, quantity and axis switches, Data | tab | R | view controls |
| Phone | Range tab | below 48em | R | range mode entry |

The default classes of the refined spec hold. Bore diameter, bullet mass and the measured capacity are added to the always-visible set because they are in view today and change the result directly.

## Build issue drafts (each one pull request)

1. **Workbench: pinned row for primer, brass and capacity above the input cards.** From 75em one row across both columns (labels above, or beside at 28 px if the German labels fit), below 75em the first block of the Load flow; the cartridge search as its first select (reading order). Moves `PrimerChoice`, `CaseChoice` and `CapacityChoice` out of the Cartridge card's More (the seating slot `more` keeps the notes and values). Acceptance: `workbench-no-scroll.spec.ts` passes at every size it checks, in German too (the 30 % pass here scrolls by 28 px: the row must give that back); keyboard order equals visual order; `apps/web/AGENTS.md` updated. Unblocks #36 (the primer picker gets a visible place) and #25 (own brass groups chosen in view); builds on #265 (Brass) and #266 (the example's brass record shown).
2. **Workbench: picker slot for lots.** A lot select per component (powder, primer, brass) beside its choice, reading the user's lot records; the Notes tab keeps the text fields until then. Unblocks #25.
3. **e2e: one check per layout rule.** `workbench-no-scroll.spec.ts` gains the pinned row's three selects shown without a tap at 1280 x 650 and 1366 x 657; a spec reads the keyboard order of the inputs against their boxes (the inversion count of `apps/e2e/scripts/workbench-layout-measure.mts`); the layout shift of the inputs while the charge is typed is 0. Covers the pick for #374's one pattern for views.
4. **Phone: group tabs in the Load tab (optional, variant C).** Only if the phone page scroll is to go: three group tabs below 48em. Costs a tap to the charge. Not needed for the pick.

Primer, brass and capacity no longer need More after issue 1; nothing else moves out of it.

## Prototype files

`apps/web/src/app/prototype-workbench/page.tsx`, `apps/web/src/app/prototype-workbench.css`, `apps/web/src/components/prototype-workbench.tsx`, the route added to `frameRoutes` (`page-shell.tsx`) and `toolRoutes` (`sections.ts`) so it gets the workbench frame, `apps/e2e/scripts/workbench-layout-measure.mts`. The shipped workbench components and the e2e specs are untouched.
