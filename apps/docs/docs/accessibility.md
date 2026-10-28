---
title: Accessibility
description: What was evaluated for accessibility, with which tools and on which pages, the findings of the agent audit of 2026-10-27, the known gaps with workarounds, how the audit is repeated and the steps of the manual screen-reader pass.
---

# Accessibility

This page says what was checked for accessibility in the web app, how, and what is known to fall short. The target is WCAG 2.2 Level AA ([W3C Recommendation, 12 December 2024](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)). The method follows the sample-based evaluation of WCAG-EM 2.0 ([W3C Group Note](https://www.w3.org/TR/2026/NOTE-wcag-em-2-20260723/)). A sample cannot show that no error remains, so this page makes no claim of conformance and no claim under any law. It lists what was evaluated and the gaps found.

Scope: the web app (the static browser app). The docs site and the REST reference are not covered.

Gated scope, where a failure of a Level A criterion blocks the 1.0 release: the workbench, the session summary, the shot groups and the Database lists. Every other finding is on the known list below and is published with the release.

## Audit of 2026-10-27

An agent drove the app with Playwright and read the browser's accessibility tree, the focus order and the rendered pixels. No screen reader was run by the agent. The screen-reader evidence is the maintainer's manual pass (steps below); until its results are added to this page there is none.

### Baseline

| Item | Value |
|---|---|
| Browser | Chromium 156.0.8078.4 (Playwright's headless build), Linux. Firefox 157.0 (Playwright build 1555) was installed but cannot start in the audit container (system libraries `libgtk-3` and others are missing), so no Firefox run was made. Safari was not available |
| Assistive technology | none. Keyboard only (Tab, Shift+Tab, arrows, Enter, Space, Escape and the app's own keys), the browser's accessibility tree (`ariaSnapshot`) and live-region observers |
| Settings and modes | widths 320, 390 and 1280 CSS px, light and dark, text spacing of WCAG 1.4.12 injected, text size 200 %, a 640 px window as 200 % browser zoom, reduced motion, forced colours (Chromium's emulation) |
| Build | the static sample export of the tree at the date of the audit (`npm run static:build`, `npm run pages:serve`), and a full export for the random sample |

### Tool versions

| Tool | Version |
|---|---|
| axe-core | 4.14.0, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` |
| @axe-core/playwright | 4.14.0 |
| Playwright | 1.64.1 |
| Chromium | 156.0.8078.4 |
| Node.js | 26.10.0 |

### Sample

Structured sample:

- 23 routes without a dynamic segment (every `page.tsx` under `apps/web/src/app` without `[`), at 320, 390 and 1280 px in light and dark.
- One record page per record kind: cartridge (308 Win.), bullet, powder, case, primer, target, discipline, federation.
- States: the first-visit Safety dialog, the workbench start card, the workbench after the example run with every result tab, the Open menu and Saved loads drawer, Chart data, the bullet search dialog, Settings (General, with its shortcut choice), Keyboard shortcuts, site search, the Safety notice, the photo tool with its sample photograph, the Page actions panel at 320 and 390 px, range mode with a saved load, a typed invalid number, a refused run, an unreadable chronograph file, tooltips by hover and by focus.

Random sample (WCAG-EM 3.2), added on top: 10 % of each record kind's id list in the full export, at least one per kind, drawn with a seeded generator (mulberry32, seed 20261027): 106 of 1,019 records (58 of 577 cartridges, 1 of 2 bullets, 1 of 1 powders, 1 of 1 cases, 1 of 2 primers, 5 of 54 targets, 38 of 376 disciplines, 1 of 6 federations). Each page at 320 and 1280 px, light and dark, with axe, a check for horizontal scrolling and the text-spacing check.

Complete processes, each run start to end by keyboard:

| Process | Result |
|---|---|
| 1. First visit: Safety dialog, workbench, example load, run, read results | Completed by keyboard. The Safety dialog is announced as a modal with a name, holds focus and is accepted with Enter; the run announces "Simulating" and then the result line; the chart has a name, a description and a readout slider with spoken values; Chart data opens a table dialog and Escape returns the focus. Findings A-01, A-07, A-08 |
| 2. Compose a load from records, run, save, reopen, print | Completed by keyboard: the cartridge, bullet and powder are chosen with the arrow keys and Enter, the bullet dialog holds focus and returns it, Ctrl+Enter runs, Ctrl+S announces "Saved", the load reopens from the Saved loads drawer. A typed non-number is marked invalid with its message tied to the field. The printed report was read as text only: its order is title, load line, notes, cartridge, bullet, powder, gun, then the results. Findings A-01, A-07 |
| 3. Chronograph file on the Measurements tab, map strings, save, reopen | Completed by keyboard apart from the native file chooser, which cannot be driven by the audit tool: the file control is reached by Tab with a visible focus indicator and the file was supplied to it directly. The read result and an unreadable file are both announced (`status` and `alert`). The string mapping is a native select |
| 4. Photo tool: open, choose a photograph, set the scale, cut out, open in the designer | Completed by keyboard with the sample photograph (the native chooser was not driven). The canvas is announced as an application named "Photograph of the bullet" with its keys as the description; keys place points and paint; every action is announced in a status line. Scale points and brush discs can also be set by single clicks, so no drag is needed. Finding A-07 (focus after closing) |
| 5. Range mode on a phone width | Completed by keyboard at 390 px and at 320 px with a touch emulation: the entry is behind Page actions on the session summary, a 10-shot string is typed with Enter, each shot is announced ("Shot 10 saved on this device"), every control is at least 44 px at 390 px. Finding A-03 (the Page actions panel at 320 px) |

The sixth process of the evaluation plan (design a target, save, use it as the target of a shot group) was not run as a process. The target designer and the shot group sheet were checked by axe and by the checks of the shot groups.

## Findings

Severity: blocker is a failure of a Level A criterion in the gated scope. Major is a failure of a Level AA criterion. Minor is everything else, including checks without a success criterion and failures that depend on how a criterion is read. Counts: 2 blockers (both fixed), 7 major (5 fixed, 1 in part), 6 minor (1 fixed, 1 in part).

| Id | Severity | Criterion | Page and state | Evidence | Status |
|---|---|---|---|---|---|
| A-01 | blocker | 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA) | Workbench, a run the model refuses (example load, charge 99 g) | The results error said "interior: chamberVolume" and "Reason: chamberVolume", the model's code and no description of the fault | Fixed: the error now says in one sentence what is wrong and what to change, for each of the six reasons, with the code kept below it. Vitest test and a check in `workbench-messages.spec.ts` |
| A-02 | major | 2.4.7 Focus Visible (AA) | Workbench below 48em (390 and 320 px), Tab order | A second "Run simulation" button inside the form, clipped to 1 px for screen readers, took a Tab stop with nothing visible (two stops reported by the focus check, a blank frame at that stop). The visible Run button is the next stop | Fixed: the form's own Run bar is not shown below 48em, so Run is one button. `workbench-phone.spec.ts` |
| A-03 | major | 1.4.10 Reflow (AA) | Page actions panel at 320 px, on every page with page actions (session summary, workbench, record pages, designers) | The panel is anchored to the right edge of its bar and is 213 px wide: its left 40 px lie outside the window (the Range mode button measures x = -40 to 173), so "Range mode" reads "ge mode" and "Export JSON" reads "ort JSON". At 390 px it fits (x = 30 to 243) | Fixed: below 22.5em the panel ends 0.5 rem before the window's right edge (CSS in `globals.css`). `a11y-states.spec.ts` measures it at 320 and 390 px and sweeps it with axe |
| A-04 | major | 1.4.12 Text Spacing (AA) | Workbench at 1280 px with the spacing of the criterion applied; groups; designers at 320 px | Labels cut with an ellipsis: "Usable case v...", "Powder temper...", "Ladder steps...", "Diameter x le...", "Ballistic coeffi..."; the readout bar and the result head are cut; the tabs Groups and Notes move into More. On the shot groups the Set and Clear button labels are clipped by 3 px; at 320 px the labels of the bullet, powder and target designers are cut. In the random sample the record page's title (and a cartridge's alias badge) is cut in 3 of 106 pages at 1280 px or 320 px. The full text stays in each control's accessible name | Fixed: labels, readout names, segment labels, the record page's title and the alias badge wrap instead of ending in an ellipsis, rows grow, and a field widens for its value. The aim fields of the shot groups go below Set and Clear when the row has no room. Record names and the load title keep the ellipsis with the full text on hover. `text-spacing.spec.ts` applies the spacing and finds nothing cut on these states |
| A-05 | major | 1.4.13 Content on Hover or Focus (AA) | Tooltips of buttons and symbols (record page symbols such as Pmax, sidebar and header icon buttons) | Escape dismisses them and they stay while hovered (4 s), but moving the pointer from the trigger onto the tooltip closes it, so it is not hoverable. The chart tooltip passes: it ignores the pointer and Escape hides it | Fixed: every tooltip stays open while the pointer moves from its trigger onto it, until the pointer leaves both, the trigger loses focus or Escape is pressed. `tooltip-hover.spec.ts` |
| A-06 | minor | none of its own; 1.4.1 and 1.4.11 read under forced colours | Workbench in forced colours: segmented controls (COAL and CBTO, Charge, Seating and Temperature, Up, Down and Around, Cartridge, Chamber and Combined, the chart's series and axis toggles) | Chromium's forced-colours emulation removes the selected segment's fill, and no border or mark remains, so the selected value cannot be seen. The selected tab keeps its underline. The controls expose their state to assistive technology | Fixed: under forced colours the selected segment has a 2 px border in the system highlight colour (CSS in `globals.css`). `a11y-states.spec.ts` checks it with Chromium's emulation |
| A-07 | blocker | 2.4.3 Focus Order (A) | Workbench start card, Saved loads drawer, photo tool | Focus falls to the start of the page after choosing a cartridge or "Try the example load" (the start card is replaced), after closing Saved loads with Escape (its opener, a menu item, is gone) and after closing the photo tool with Escape although its button still exists. The focus order itself is in reading order everywhere else | Fixed: the focus goes to the first control of the load form after the start card is replaced, back to Open (or Page actions below 75em) after Saved loads closes and back to From a photo (or Page actions) after the photo tool closes. It was a Level A failure in the gated scope, so a blocker for 1.0. `focus-return.spec.ts` |
| A-08 | minor | 3.3.1 wording | Workbench, status line after a refused run | The status text is "The API answered 422." although the browser app has no server, and it is announced | Open. The error panel (A-01) states the fault |
| A-09 | minor | 1.4.11 Non-text Contrast (AA) | Workbench chart, light theme | Rendered pixels: pressure line 3.20:1, velocity 4.42:1, energy 3.22:1 against white; one colour of the chart measured 2.78:1 (47 px of about 200,000, most likely the fainter lines of the other ladder steps). Dark theme: 4.66:1, 4.97:1, 5.31:1, no colour under 4.7:1 | Open. The Ladder table tab lists every step |
| A-10 | minor | none (axe best practice `region`) | An open tooltip, for example the sidebar's Search button focused on a record page | The tooltip is outside every landmark | Open |
| A-11 | minor | 1.4.4 Resize Text (AA), 1.4.10, 1.4.12 | Most pages at 200 % text size, at 640 px and at 320 px; designers and record pages at 320 px with the spacing of 1.4.12 | The page title in the page bar is cut with an ellipsis ("Loa..." at 320 px). Below 75em the bar is in the app header and the title has two lines; with the spacing of 1.4.12 a title such as "22 Long Rifle" needs a third. The full title is in the document title and in the heading's text | Partly fixed: below 75em the title area scrolls in the app header where the title needs more lines than the band leaves, so nothing is cut with the spacing of 1.4.12 (`text-spacing.spec.ts`). The 1.4.4 and 1.4.10 parts (200 % text, 640 px) are open until rechecked |
| A-12 | minor | 4.1.3 Status Messages (AA) | Shot groups, shots placed by pointer | After four shots only "Saved in this browser" is announced, not the shot count or the score. The count and the score are text on the page and the shots have named buttons and x and y fields | Open |
| A-13 | major | 2.5.8 Target Size (Minimum) (AA) | Record pages of cartridges whose dimensions table has notes: 2 of the 58 random cartridges (32 Rus, 8), at every width and in both schemes; the structured sample's cartridge (308 Win.) has none | The note buttons "Cartridge l (mm)" and "Chamber L (mm)" are 108 and 106 px wide and 16.3 px high with 18.6 px of free space to their neighbours (axe `target-size`, 2 nodes per page) | Partly fixed: the note buttons of the variants matrix ("Cartridge l" and "Chamber L", the two axe violations) now have a 24 px target, measured by `a11y-states.spec.ts`. The small symbol buttons of the dimensions table remain below 24 px (axe lists them for review) and stay on the known list of the automated sweep. Workaround: the note is the button's description for a screen reader and the arrow keys move between the symbols |
| A-14 | major | 1.4.12 Text Spacing (AA) | Page bar of the workbench and the designers at 1280 and 390 px with the spacing of the criterion applied | The status line ("Result of ...", "Unsaved changes, not saved to a file") is cut by its column. At 1280 px the file state is cut with an ellipsis without the spacing too | Fixed: the line keeps its ellipsis and shows its whole text in a tooltip on hover, keyboard focus (the line is a Tab stop while it has text) and tap; the state stays announced. `text-spacing.spec.ts` |
| A-15 | major | 1.4.12 Text Spacing (AA) | Workbench charts (interior chart, burn rate) with the spacing of the criterion applied | Axis and unit labels drawn in the charts are cut by the chart box | Open. Workaround: the Chart data dialog and the burn rate's values table list every value with its unit |

The random sample (106 pages, 424 states) found one failure type that the structured sample did not show, A-13, and repeated A-04 on titles. It found no horizontal scrolling and no other axe violation. The "needs review" results of the random pages are the two kinds the sweep already lists as reviewed (text inside drawings and charts, and the small symbol buttons of the dimensions table).

## Results of the automated runs

| Run | Result |
|---|---|
| Sweep in CI (`a11y-sweep.spec.ts`, `a11y-states.spec.ts`), re-run on the audit build | 248 tests passed: every route, one record per kind, the workbench after the run and the open dialogs, at 320, 390 and 1280 px, light and dark |
| axe on the structured sample (31 pages, 3 widths, 2 schemes = 186 states, all rule tags and best practice) | 0 violations; "needs review" results only where the sweep's reviewed list already holds them |
| Horizontal scrolling at 320 px | none on the 31 pages of the structured sample, the workbench after a run (320 x 256, 320 x 800 and 640 x 450) and the first-load states |
| Focus indicator (every Tab stop, pixels compared with and without focus) | workbench after a run: 111 stops at 1280 px in light, dark and forced colours, all show a change; 390 and 320 px: all but A-02. Database lists, session summary, range mode: all show a change |
| Focus covered by a sticky bar (2.4.11) | none: the centre of every focused control is uncovered at 1280, 390 and 320 px; the visually hidden inputs of chart readouts and segmented controls show their indicator on a visible parent |
| Reduced motion | no animation runs after load and after a run; Play shows the bullet at the muzzle; Play can be paused |

## Known list

Open findings with the reason they are not fixed yet and the way round them. The two Level A failures found in the gated scope (A-01 and A-07) are fixed.

| Id | Why it stays | Workaround |
|---|---|---|
| A-13 | The symbol buttons of the dimensions table are text-sized by design; a 24 px target for every symbol makes each row of the table taller, which needs a design decision | The note is the button's description; arrow keys move between the symbols |
| A-15 | The charts lay out their labels inside a fixed box | Chart data and the values table |
| A-08 to A-12 | Minor; wording, one chart colour, the title at 200 % text and 640 px, and a status message | See each row |

## Not covered by this audit

- No screen reader: not NVDA, JAWS, VoiceOver, TalkBack or Narrator. Names, roles and states were read from the accessibility tree and live regions were observed, which is not what a screen reader says.
- Browsers other than Chromium; touch devices (a touch emulation of Chromium was used for range mode); real forced-colours and high-contrast themes of an operating system.
- Native file choosers and the print dialog, which the audit tool cannot drive.
- Zoom of the browser itself: a 640 px window stands for 200 % and a 320 px window for 400 %; text-only zoom was a 200 % root font size.
- The German interface, the docs site, the REST reference and the printed report beyond its text order.
- Users of assistive technology. No review by such users was done.

## Rerun

| What | When |
|---|---|
| Automated sweep (axe, all tags and best practice, 320, 390 and 1280 px, light and dark, record pages, open dialogs, workbench after a run) | every CI run. A new dialog or state adds a state to `apps/e2e/tests/web/a11y-states.spec.ts` |
| Agent audit: the complete processes by keyboard and Playwright, the focus order and tree at 320, 390 and 1280 px, 200 % zoom, text spacing, reduced motion, forced colours, and a random sample with a recorded seed | before each minor release, and in full when the component library or the theme changes |
| Manual pass by the maintainer with a screen reader (steps below) | before each minor release on the complete processes, and in full when the component library or the theme changes |

The results of each run replace the audit section of this page with its date, baseline, sample and tool versions.

## Manual pass: steps

Do the steps once with the keyboard only, once with NVDA on Windows (Firefox or Chrome) and once with VoiceOver on macOS (Safari). Record per step: pass, fail or not possible, the screen reader and browser with versions, and what was spoken for a failure. Report the results as a comment on the accessibility task, one line per step.

Set up: a release candidate build, a fresh browser profile (so the Safety dialog appears), speech on, the pointer put away. NVDA: browse mode for reading, Tab for controls, Insert+F7 for the elements list. VoiceOver: VO is Control+Option; VO+U opens the rotor, VO+Right reads on, VO+Space activates.

### 1. First visit and workbench run

1. Open the app. The Safety dialog is announced as a dialog with its name. Tab cycles between Decline and I accept and never leaves the dialog. Press Enter on I accept.
2. Read the home page: one heading level 1, the Tools and Library regions, the links with their purpose (NVDA: H to walk the headings, D the landmarks. VoiceOver: rotor, Headings and Landmarks).
3. Open the Load workbench link. On the start card press Try the example load. Where does the focus go? (Expected: the first field of the load form.)
4. Tab to Charge mass, press Control+Enter. Listen for "Simulating", then "Simulation done" with the peak pressure and velocity, without the focus moving.
5. Read the result tiles and list. Each value has its label and unit.
6. Reach the chart by Tab. It is announced as an image with a name and a description. Tab to its readout slider and press the arrow keys: each press speaks time, travel, pressure, velocity, energy and the burnt share. Press Home and End.
7. Press the Chart data button. The dialog is announced; its table has column headers; Escape closes it and the focus is back on the button.
8. Switch the tabs (Chart, Ladder table, Trajectory) with the arrow keys; each panel is announced.
9. Press Play on the playback strip, then Pause. Turn off the screen reader's speech of the chart and check that Escape hides a hover tooltip.

### 2. Compose a load from records, save, reopen, print

1. On a new workbench type a cartridge name in the Cartridge field, move with the arrow keys, press Enter. The count of found records is announced while you type.
2. Browse bullets: the dialog is announced, the first focus is its search box, Tab stays inside it, Escape closes it and the focus returns to Browse bullets. Choose a bullet in the Bullet card and a powder in the Powder card.
3. Type a charge, the usable case volume and run. Type "abc" in the charge field and leave it: the error is announced with the field.
4. Type 99 as the charge and run: the error says the charge does not fit the chamber, in words.
5. Press Control+S. "Saved" is announced.
6. Open, Saved loads: the drawer is announced, its list items have names that tell the loads apart, Escape closes it. Open the saved load and run it.
7. Press Print. Read the print preview or the printed page in browse mode: the order is title, load line, notes, cartridge, bullet, powder, gun, results.

### 3. Chronograph file on the Measurements tab

1. In a workbench with a result, open the Measurements tab. Tab to the Chronograph file control: it is announced with its label and hint. Press Enter and choose a CSV file.
2. "Read ... strings" is announced. Choose a file that is not a chronograph export: an error is announced without moving the focus.
3. Map a string to a ladder step with the select of that string. The names say which string and which step.
4. Save, reload the page, open the saved load: the strings and the mapping are back.
5. Open Session summary. Load the example: the status line announces the strings and shots, the tables have headers and captions, and the statistics are text.

### 4. Photo tool

1. Open the Bullet designer. Press From a photo: the dialog is announced with its name, the first focus is inside it.
2. Press Try a sample. The measured table (length, diameter, uncertainty) is read in browse mode.
3. Tab to the photograph. It is announced as an application named "Photograph of the bullet", with the description of its keys. Switch the screen reader to the mode it needs for applications (NVDA: it switches by itself; VoiceOver: interact with VO+Shift+Down).
4. Press the arrow keys, then Enter: "Point C placed." is announced. Press Control with an arrow for a large step and Shift for one pixel. Choose the Brush: add tool and press Enter: "Added to the bullet." is announced.
5. Press Open in designer. The length field holds the measured value.
6. Press Escape in an open photo tool: where does the focus go? (Expected: the From a photo button.)

### 5. Range mode on a phone width

Use a phone or a 390 px window. With a keyboard if there is one; with VoiceOver on iOS (swipe right to read, double tap to activate) and TalkBack on Android where available.

1. Open Session summary, open Page actions, choose Range mode.
2. Choose a saved load in the Saved load select. Type a velocity and press Enter (on a phone, the number pad buttons then Add): "Shot n saved on this device" is announced.
3. Add ten shots. Use the exclude control of one shot: its state is announced.
4. Return with the Session summary link.

### 6. Shot groups and Database lists

Shot groups: choose a federation, a discipline and a target; Tab to the target sheet (an application with a key help); place shots with the Shot tool (a click) or the Add shot button; edit a shot's x and y fields; move a shot with Alt and the arrow keys; exclude it with E; read the score. Database lists: open Cartridges, Tab to the search field and type; sort with a header button (the sort order is announced); tick a row of the Bullets list with Space; open a record with Enter and read its fields table and its drawing description.

### Settings to repeat

Repeat processes 1 and 2 with Settings, General, Single-key shortcuts off (`?` and `/` do nothing), with the operating system's reduced motion on, in dark theme and with the browser zoomed to 200 %.
