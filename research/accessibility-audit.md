# Accessibility audit method and pass criteria for 1.0

Question: what does an accessibility audit of this app consist of, so that "passed" means something, and what should the 1.0 gate say. Sources are official texts only. Codebase claims carry file and line. Legal readings are marked unverified and are not legal advice.

## Summary

- Target: WCAG 2.2 Level AA, evaluated with the W3C evaluation methodology (WCAG-EM 2.0): scope, explore, structured plus random sample, evaluate, report.
- Automated checks cover a small part of the success criteria. With the pinned axe-core 4.14.0, 21 of the 55 Level A and AA criteria of WCAG 2.2 have at least one stable rule, and for several of those the rule tests only one narrow aspect. The existing sweep (`apps/e2e/tests/web/a11y-sweep.spec.ts`) covers the 22 static routes in their first-load state, at 390 and 1280 px, light and dark. It does not cover record pages, dialogs, popovers, results, keyboard use, zoom, text spacing or screen reader output.
- A manual pass is needed for: keyboard operation and focus handling (2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11), character key shortcuts (2.1.4), dragging alternatives (2.5.7), reflow and text spacing (1.4.10, 1.4.12), content on hover or focus (1.4.13), non-text contrast of charts and drawings (1.4.11), the text alternative of every chart, drawing and the photo canvas (1.1.1), status messages (4.1.3) and screen reader behaviour (4.1.2).
- Three candidate failures turned up while reading the code and are listed in "Candidate findings". They are items to verify, not verdicts.
- The European Accessibility Act most likely does not reach a free calculator without a consumer contract (unverified reading). The 1.0 gate should not depend on that reading: WCAG 2.2 AA is a sound quality bar on its own.

## Sources

| Source | Version used | URL |
|---|---|---|
| WCAG 2.2 | W3C Recommendation, 12 December 2024 | https://www.w3.org/TR/2024/REC-WCAG22-20241212/ |
| Understanding WCAG 2.2 | current | https://www.w3.org/WAI/WCAG22/Understanding/ |
| WCAG-EM 2.0 | W3C Group Note, 23 July 2026 (not a Recommendation) | https://www.w3.org/TR/2026/NOTE-wcag-em-2-20260723/ |
| axe-core rules and API | 4.14.0, as pinned in `package-lock.json` (rules listed from the installed package with `axe.getRules`) | https://github.com/dequelabs/axe-core/blob/develop/doc/API.md, https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md |
| EN 301 549 | V3.2.1 (2021-03), harmonised European standard | https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf |
| European Accessibility Act | Directive (EU) 2019/882, OJ L 151, 7.6.2019, p. 70 | https://eur-lex.europa.eu/eli/dir/2019/882/oj |
| Services Directive (definition of service) | Directive 2006/123/EC | https://eur-lex.europa.eu/eli/dir/2006/123/oj |

Quoted text was checked against the raw pages, not against a summary. Where this note says "Understanding", it paraphrases the informative document, which is not normative.

## Applicability

### Directive (EU) 2019/882 (unverified legal reading)

1. Article 2(2) lists the services in scope: electronic communications, access to audiovisual media services, elements of passenger transport services, consumer banking, e-books and dedicated software, and e-commerce services. A ballistics calculator and record browser is none of the first five.
2. Article 3(30) defines e-commerce services as "services provided at a distance, through websites and mobile device-based services by electronic means and at the individual request of a consumer with a view to concluding a consumer contract". Recital 42 repeats it. A free tool with no sale has no such contract.
3. Article 3(3) defines "service" through Article 4(1) of Directive 2006/123/EC: "any self-employed economic activity, normally provided for remuneration". The "free of charge" wording in Article 3(15) belongs to the definition of "making available on the market" of products.
4. Article 4(5) exempts microenterprises providing services from the service requirements of Article 4(3). Article 3(23) defines one as fewer than 10 persons and a turnover or balance sheet total of at most EUR 2 million.
5. Article 14 limits the duty to what does not fundamentally alter the service or impose a disproportionate burden.

Reading: the app is probably out of scope today. What would change it: selling anything through the app (a paid edition, a shop), which would make the sale an e-commerce service under Article 2(2)(f) and recital 43, or a hosted offer provided for remuneration. National transposition laws can differ from the Directive and were not read. Confidence: medium. A lawyer should confirm before any public statement either way.

### Directive (EU) 2016/2102

It concerns websites and mobile applications of public sector bodies (named in recital 46 of the EAA text). A public body that hosts or procures the app would bring it in scope. Not read in full here: unverified.

### EN 301 549

Clause 9 (web) of V3.2.1 states that conformance with WCAG 2.1 Level AA is equivalent to conforming with clauses 9.1 to 9.4 and the conformance requirements of clause 9.6, and that web applications count as web pages (clause 9.0 and its Note 1). So EN 301 549 V3.2.1 asks for WCAG 2.1 AA. WCAG 2.2 adds 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7 and 3.3.8 at A or AA and removes 4.1.1. The axe tag `EN-301-549v4` on the target-size rule suggests a newer edition that includes 2.5.8 exists. Whether it is published or cited in the Official Journal is unverified. Article 15 of the Directive gives a presumption of conformity for products and services that follow harmonised standards whose references are published in the Official Journal. Which edition is cited is unverified.

Decision for the gate: use WCAG 2.2 AA, the stricter superset. Meeting it also meets the WCAG 2.1 AA part of EN 301 549 clause 9, except 4.1.1 Parsing, which the Recommendation removed (the axe rules for it are deprecated). Whether an auditor following EN 301 549 V3.2.1 would still test 4.1.1 is a point for the accessibility statement.

## What is tested today

Facts from the repository (`apps/e2e/AGENTS.md`, the specs, `apps/e2e/playwright.config.ts`).

### The sweep

- Routes: every `page.tsx` without a `[` segment under `apps/web/src/app` (`a11y-sweep.spec.ts:11`). That is 22 routes: `/`, `/workbench`, `/range`, `/session`, `/groups`, `/firearms`, `/my-cases`, `/offline`, the eight list pages (`/cartridges`, `/bullets`, `/powders`, `/cases`, `/primers`, `/targets`, `/disciplines`, `/federations`), `/bullets/compare`, `/powders/burn-rates` and four designers (`/cartridges/designer`, `/bullets/designer`, `/powders/designer`, `/targets/designer`). With 2 widths and 2 colour schemes that is 88 tests (`:30`).
- Rules: `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` (`:40`). In axe-core 4.14.0 the rule `target-size` ships with `enabled: false`, but a tag match ignores that flag (`ruleShouldRun` and `matchTags` in `node_modules/axe-core/axe.js`), so the sweep does run it. The default tag exclusion drops experimental and deprecated rules, so `css-orientation-lock` (1.3.4) and the rules for 4.1.1 do not run.
- The best-practice rules (`region`, `landmark-*`, `heading-order`, `aria-dialog-name`, `skip-link` and others) are not in these tags, so the sweep does not run them. Specs that call `.analyze()` without tags run the best-practice rules but not `target-size`, because it is disabled by default: `target-designer`, `powder-designer`, `drawing-face`, `bullet-photo`, `truing`, `workbench-messages`, `workbench-band`, `workbench-volume-note`, `firearm-library`, `workbench-lot-rows`, `safety`.
- The assertion lists `violations` only. `incomplete` ("needs review") results are never read. Per the axe API, incomplete means a result "could neither be determined to definitively pass or definitively fail".
- State: the page after load and `networkidle`, in Chromium, with the Safety dialog already accepted and service workers blocked (`playwright.config.ts:9-24`). The API document says: "Axe does not test hidden regions, such as inactive menus or modal windows". So closed dialogs, menus, popovers and the workbench after a run are not seen by the sweep.
- `known` is empty (`:17`), so no violation is waived today.

### Other axe runs

| Spec | Scope |
|---|---|
| `settings-dialog`, `bullet-search-dialog`, `bullet-photo` | the dialog, with the full tag set in the first two |
| `cartridge-designer`, `groups-face`, `range-mode`, `directory-window` | full page, full tag set, light and dark (range mode at 390 px) |
| `target-designer`, `powder-designer`, `firearm-library`, `truing`, `workbench-band`, `workbench-lot-rows`, `workbench-messages`, `workbench-volume-note` | a region or page, default rules |
| `drawing-face` | `figure.drawing-figure` on two cartridge pages |
| `safety` | `color-contrast` only, on the Safety buttons |

No spec runs axe on a full record page (`/cartridges/<id>` and the seven other `[id]` routes), the shortcuts help dialog, the chart Data modal or the site search.

### Non-axe checks that already exist

- Reduced motion: Play shows the bullet at the muzzle with no flight (`workbench-playback.spec.ts:52`), `useReducedMotion` in `chart-playback.tsx` and `interior-chart.tsx`.
- Keyboard: chart readout keys, the bullet search dialog with focus returned (`bullet-search-dialog.spec.ts`), photo canvas keys, slider keys, the table's End key. 11 specs assert focus with `toBeFocused`.
- Target size: range mode asserts every control at least 44 px at 390 px (`range-mode.spec.ts:214`).
- Contrast of tokens: `apps/web/test/drawing-tokens.test.ts` computes the WCAG ratio for drawing lines and text (3:1 and 4.5:1 against `--bg`), every chart series (3:1), disabled text and each message variant, in both themes (`:35`, `:47`, `:60`, `:69`).
- Layout: `workbench-no-scroll.spec.ts` (cut-off and overflow at several sizes), 390 px fits in several specs.
- Zoom is not blocked: `viewport` in `apps/web/src/app/layout.tsx:91` sets only `themeColor`, and `<html lang="en">` is set (`:101`).

### Which success criteria axe can reach

Rules per criterion in axe-core 4.14.0 (`axe.getRules` with the five tags; experimental and deprecated rules left out): 1.1.1, 1.2.2, 1.3.1, 1.3.5, 1.4.1 (`link-in-text-block` only), 1.4.2, 1.4.3, 1.4.4, 1.4.12 (`avoid-inline-spacing`, which checks inline `!important` styles, not that spacing can be changed), 2.1.1 (`scrollable-region-focusable`, `frame-focusable-content`, `server-side-image-map`), 2.2.1, 2.2.2, 2.4.1, 2.4.2, 2.4.4, 2.5.3, 2.5.8, 3.1.1, 3.1.2, 3.3.2 and 4.1.2. Criteria with no stable rule (34): 1.2.1 (deprecated rule only), 1.2.3 to 1.2.5, 1.3.2, 1.3.3, 1.3.4, 1.4.5, 1.4.10, 1.4.11, 1.4.13, 2.1.2, 2.1.4, 2.3.1, 2.4.3, 2.4.5 to 2.4.7, 2.4.11, 2.5.1, 2.5.2, 2.5.4, 2.5.7, 3.2.1 to 3.2.4, 3.2.6, 3.3.1, 3.3.3, 3.3.4, 3.3.7, 3.3.8 and 4.1.3.

Even where a rule exists it tests the presence of a mechanism, not its quality. `svg-img-alt` and `role-img-alt` pass for a chart named "x" with a useless description. `color-contrast` skips disabled and inert elements and range inputs (`colorContrastMatches` in `axe.js`) and returns needs review where it cannot decide. `target-size` is evaluated from the rendered boxes of the page state it sees.

## Audit protocol

WCAG-EM requirement numbers in brackets.

### 1. Scope [1.1 to 1.4]

- Target: the web app as built by `npm run build -w @open-reloading/web` in both editions (server and Pages), at a tagged release candidate. The docs site and the REST reference are not in scope (they are separate artefacts, with their own check, if wanted).
- Level: WCAG 2.2 AA [1.2]. AAA criteria are not in the gate. Project goals beyond AA are listed under "Pass criteria".
- Accessibility support baseline [1.3] (proposed, to be fixed before the audit starts and recorded in the report):
  - Desktop: current Chrome and Firefox, NVDA (Windows), VoiceOver with Safari (macOS).
  - Phone: VoiceOver with Safari (iOS), TalkBack with Chrome (Android).
  - Input: keyboard only, pointer, touch; browser zoom 200% and 400%; forced colours and `prefers-reduced-motion: reduce` on.
  - Print and downloaded files are out of the WCAG scope of the screen app. The printed report is checked for text order only.
- Conformance requirements to hold (WCAG 2.2 section 5.2): full pages (no part of a page excluded), complete processes (every page of a process conforms), accessibility-supported technologies only, non-interference. The app is a single-page client application, so "page" means each route and each state reachable inside it.

### 2. Explore [2]

- Common views: the five navigation entries and their pages (`apps/web/src/lib/sections.ts`), plus record pages.
- Essential functionality: run a simulation and read the result; enter values in any unit; save and reopen a load; read a record with its sources; design a cartridge, bullet, powder or target; read a chronograph file; enter range shots on a phone.
- Technologies relied upon: HTML, CSS, JavaScript, SVG (hand-built drawings, ECharts SVG renderer in `apps/web/src/components/echart.tsx`), `canvas` (photo tool, `bullet-photo.tsx:216`), Web Workers, service worker (offline layer), File System Access and file inputs, print stylesheets, Mantine components.
- Other samples: dark theme, the first-visit dialog, error and empty states, the offline page, the installed (PWA) window.

### 3. Sample [3]

Structured sample (list in the next section): about 22 routes, 8 record pages (one per `[id]` route, with the variants that differ in structure), 15 to 20 dialogs and states, and the complete processes below. Random sample [3.2]: 10 percent of the structured sample set, added on top, drawn with a recorded seed from the record id lists of the API (so each record type has a chance of an unusual record: a shotshell, a record without a drawing, a record with many sources). The random set must not show failure types absent from the structured set [4.3]; if it does, extend the structured set and repeat.

Complete processes [3.3], each audited start to end as one process:

1. First visit: Safety dialog, then the workbench, load the example, run, read results.
2. Compose a load from records (search a cartridge, bullet and powder), run, save, reopen from Saved loads, print the report.
3. Import a chronograph file on the Measurements tab, map strings, save, reopen.
4. Photo tool: open the dialog, choose a photograph, set the scale from the keyboard, cut out, open in the designer.
5. Range mode on a phone: pick a saved load, add a 10-shot string, exclude a shot, return home.
6. Design a target, save, use it as the face of a shot group.

### 4. Evaluate [4]

Per sample, in this order, each step's output recorded:

1. Automated (agent, CI): axe-core with the five tags plus `best-practice`, `incomplete` results listed, on the page and on each opened state (dialogs, popovers, menus, result views, both themes, 390 and 1280 px, plus 320 px).
2. Keyboard (maintainer or reviewer): put the pointer away. Tab and Shift+Tab through the page, then through each opened state. Check: every function reachable (2.1.1); no trap (2.1.2); order matches meaning (2.4.3); focus indicator visible (2.4.7, and 1.4.11 for its contrast); focus never hidden under the sticky Run bar, readout bar or header (2.4.11); dialogs take focus, hold it, close with Escape and return it to the opener; shortcuts behave (2.1.4).
3. Screen reader (maintainer or reviewer, on the baseline): per complete process, listen for: names, roles and values of every control (4.1.2), table headers and captions, chart and drawing text alternatives (1.1.1), live updates after Run and on warnings (4.1.3), dialog announcement, canvas announcement. Record the screen reader, version and browser.
4. Zoom, reflow and spacing: at 200% text-only zoom, at a 1280 px window at 400% browser zoom (the Understanding of 1.4.10 gives 320 CSS px as equal to a 1280 px viewport at 400%, and 256 CSS px for height), and with the text spacing of 1.4.12 applied through a bookmarklet or user stylesheet. No loss of content or function, no two-dimensional scrolling except the content the SC excepts (data tables as a whole, drawings, maps, charts needing two dimensions). Toolbars and result bars must still show their content.
5. Contrast and non-text contrast, both themes: text 4.5:1 (3:1 for large), UI component boundaries, focus indicators, states and chart marks 3:1 against adjacent colours (1.4.3, 1.4.11). Use a pixel sampler on the rendered chart and drawing, not only token pairs. Colour is never the only carrier (1.4.1): check chart series, warning severity, ladder cells, ring scoring, shot groups.
6. Target size (2.5.8): every pointer target at least 24 by 24 CSS px or inside the spacing, inline, equivalent, user-agent or essential exceptions. Use the axe `target-size` result plus a script that measures all `button, a, input, [role=button], [role=slider], [tabindex]` boxes per state and lists those under 24 px.
7. Pointer and touch: single pointer alternatives to every drag (2.5.7), no path-based gesture as the only way (2.5.1, `use-pinch.ts`), cancellation on up-event (2.5.2), label in name (2.5.3).
8. Motion: nothing flashes (2.3.1), playback and any auto-start animation can be stopped or lasts under five seconds (2.2.2), reduced motion respected (2.3.3, AAA, project goal).
9. Forms and errors: error text identifies the field and the fault (3.3.1, 3.3.3), no re-entry of data already given (3.3.7), no login so 3.3.8 does not apply, help in the same place on every page (3.2.6).
10. Compare random and structured sets [4.3].

Roles:

| Who | Does |
|---|---|
| Agent | writes and runs the automated extensions, the target size script, the keyboard-walk script, screenshots at 320 and 400%, fills the findings table from tool output |
| Maintainer | decides the sample and seed, runs the manual steps 2 to 8 on the baseline, triages findings, signs the report |
| Outside reviewer | an accessibility practitioner or users of assistive technology repeat steps 2 to 4 on the complete processes. WCAG-EM calls involving people with a range of abilities "strongly recommended", not required |

### 5. Report [5]

- Document each outcome of steps 1 to 4 [5.1]: scope, baseline, sample list with seed, tool versions, per sample per criterion: pass, fail, not applicable, with the evidence (the keystroke, the screenshot, the axe node).
- Findings table: id, criterion, level, route and state, how to reproduce, severity, status, issue link. Severity: blocker (a user cannot complete essential functionality), major (an AA failure with a workaround), minor.
- Evaluation statement [5.3]: optional. WCAG-EM says a conformance claim for a whole product cannot rest on a sample alone, because unidentified errors remain possible. So the public text says "evaluated against WCAG 2.2 AA on <sample>, with the known gaps below", not "conforms".
- No aggregate score [5.4]: WCAG-EM warns that "aggregated scores can be misleading".
- Machine-readable (EARL) [5.5]: optional; skip unless an outside reviewer asks.
- Publish an accessibility page in the docs with date, baseline, sample, known gaps and a contact for reports (the app has a Report an issue link).

## Test list per page and flow

Routes are from `apps/web/src/app`. "Auto" is what the sweep already runs; every row also needs the manual steps 2 to 8.

| Route or flow | Special attention |
|---|---|
| `/` home | cards as links with names that make sense out of context, h1 visually hidden (`titleHidden`), record counts as text |
| `/workbench`, example run | the densest page. Input cells (unit menu `aria-label="Unit of ..."`, `number-field.tsx:78`), field-level warnings (colour plus icon plus text), Run bar covering focus (2.4.11), tabs, Saved loads popover and load tabs menu (focus trap and return), Notes, Measurements, results as tiles and lists, warnings popover, print. States: no result, result with warning, with error, ladder (flat spots, lot rows), seating ladder |
| Workbench chart | `role="img"` with title and description (`echart.tsx:207`) and a hidden range input as keyboard walker; quantity and axis toggles; Data modal with the table; playback slider with `aria-valuetext` (`chart-playback.tsx:282`); tooltip dismissal (1.4.13); series told apart without colour; text in SVG contrast; reduced motion; 400% zoom |
| Workbench cartridge figure, seating preview | drawing alternative (see below), slider plus COAL field (2.5.7 satisfied by the field), deferred updates announced or not (4.1.3) |
| `/range` | 390 px, number pad 44 px (asserted), Exclude `aria-pressed`, entry field and status after adding a shot, offline |
| `/session` | file input and drop zone (`chrono-drop-zone.tsx`): drop is not the only way, errors in text |
| `/groups`, `/targets/designer` | `target-canvas.tsx`: `role="application"` (`:867`), shot buttons with names, key help `aria-describedby`, zoom and fit buttons, drag of shots and points (2.5.7), pinch (2.5.1), the loupe, scoring result as text |
| `/bullets/designer` + photo tool dialog | focusable `canvas` with `aria-label` but no role (`bullet-photo.tsx:216-220`), keyboard placement and brush, `role="status"` text, drag of scale points and brush strokes (2.5.7), tint and outline contrast on the photograph, dialog focus and Escape |
| `/cartridges/designer`, `/powders/designer` | sliders, schema errors in text, drawing, print |
| Lists (`/cartridges` and seven more) | `directory-table.tsx`: row click opens a record, checkbox is a separate target, sort headers (`aria-sort`), shift-range ticking, search with `/`, virtual window of rows (what a screen reader sees of a scrolled list), 16 px checkboxes (see below) |
| Record pages (8 `[id]` routes) | not in the sweep. Drawing figures, `FieldTable` headers, Sources, links to other records, strips, print layout. One cartridge with a drawing, one without, a shotshell, a bullet, a powder, a case, a primer, a target face with its drawing and Events table, a discipline, a federation |
| `/bullets/compare`, `/powders/burn-rates` | overlay charts: alternatives, colour independence, selection from the lists |
| `/firearms`, `/my-cases` | editors, read-only example, copy action |
| Shell | header, drawer (44 px rows), site search (`mod+K`), theme switch, Settings dialog and tabs, shortcuts help dialog (`?`), Safety first-visit dialog, install button, offline page, skip link (`results-skip-link.tsx`, `.skip-link`) |
| Print and export | printed report order and text only; no Safety text per the project rule, so no check of it here |

Page-level checks everywhere: unique title (2.4.2), one h1, headings in order, landmarks, `lang`, consistent navigation and help order (3.2.3, 3.2.4, 3.2.6), links with purpose (2.4.4), consistent identification of icons.

## Success criteria needing special attention here

| Topic | Criteria | What to look at | Today |
|---|---|---|---|
| Chart alternatives | 1.1.1, 1.3.1 | The Understanding of 1.1.1 treats a chart as content a short text cannot convey, and asks for a short plus a long alternative, with the data in a table where possible. The interior chart has title, description and a Data modal table (`interior-chart.tsx`). Check the same for every ECharts chart and for the burn-rate, compare, lot and barrel charts, and that the description is true for the displayed state | rules check presence only |
| Drawings (SVG) | 1.1.1, 1.4.3, 1.4.11, 1.4.1 | `technical-drawing.tsx` gives each drawing `title` and `desc` and `aria-labelledby`. The dimension values must be available as text somewhere (record table), and text in the SVG needs 4.5:1 | tokens tested at 3:1 and 4.5:1; rendered pixels not |
| Canvas photo editor | 1.1.1, 2.1.1, 2.5.7, 4.1.2, 4.1.3 | A `canvas` has no role; with `tabindex` and `aria-label` only, whether screen readers announce the label or an application role is needed is a manual check. Keyboard alternative exists. Dragging: Understanding of 2.5.7 says a single pointer alternative is needed and that a keyboard alternative alone does not count, since touch users may have no keyboard. Click-to-place a scale point and one click per brush disc may suffice. Verify | axe on the dialog; keyboard spec passes |
| Target canvas | 2.5.1, 2.5.7, 2.1.1, 4.1.2 | `role="application"` takes over keys from the screen reader. Pinch and pan need button alternatives (zoom buttons exist), shot moves need a non-drag way | `groups-face` axe, keys tested |
| Target size | 2.5.8 (AA), 2.5.5 (AAA, 44 px) | The theme sets checkboxes, radios and switches to 16 px and close buttons to 24 px (`apps/web/src/lib/theme.ts:18`). Understanding: the 24 px minimum is waived for the user agent's own control size only if the author did not change it, and an undersized target passes by the spacing exception (a 24 px circle centred on it must not meet another target or another undersized target's circle). Row ticking in dense lists is the likely failure | sweep runs `target-size` on first-load states only |
| Focus handling in dialogs and popovers | 2.1.2, 2.4.3, 2.4.7, 2.4.11 | Modal built in `app-modal.tsx`; popovers use `trapFocus` and `returnFocus` (`app-popover.tsx:22`, `load-tabs.tsx:75`). Check first focus target, Tab cycle, Escape, focus return when the opener was removed, nested dialog from a dialog (Chart data inside a popover), toast or status text. Understanding of 2.4.11: a modal dialog passes because it takes focus; sticky bars are the usual risk, and CSS `scroll-padding` is the listed technique (C43). The code already sets scroll padding for the Run bar (`globals.css:931`, `:4361`) | partly in specs; not for all dialogs |
| Reflow | 1.4.10 | 320 px wide and 256 px high. The workbench is a multi-column tool that fits a window only from 1280 x 650 (see `apps/web/AGENTS.md` and `workbench-no-scroll.spec.ts`); below that only the inputs column scrolls. At 320 px check one-column order, that result bars do not cover content, and that tables and drawings scroll as whole units. The SC excepts parts that need two-dimensional layout, named in its note: images required for understanding such as maps and diagrams, and data tables, but not the cells' content or the headings and search above a table | nothing at 320 px |
| Text spacing and resize | 1.4.4, 1.4.12 | Dense cells at 24 px field height (`--field-height`) clip text when spacing grows. Fixed heights and `overflow: hidden` are the failure pattern | not tested |
| Colour contrast, both themes | 1.4.3, 1.4.11, 1.4.1 | Text, placeholders, disabled text where it carries information, borders of inputs (3:1, `globals.css:4338`), focus rings (`--focus`, 3 px outline at `:310`) against every surface, selected states, chart marks, severity fills, hover-only changes. Check states axe does not render (hover, focus, selected, error, ladder cells) | token tests plus the sweep for the visible text |
| Reduced motion | 2.3.3 (AAA), 2.2.2, 2.3.1 | WCAG 2.2 Level AA has no criterion on `prefers-reduced-motion`; 2.3.3 is AAA, and the Understanding names the media query as technique C39. The Play button starts motion on request, so 2.2.2 (auto-start longer than five seconds) is not engaged by it. Mantine transitions and any CSS animation elsewhere are not covered: `globals.css` has no `prefers-reduced-motion` rule (grep) and the theme sets no `respectReducedMotion`. Treat as a project goal | playback spec only |
| Keyboard shortcuts | 2.1.4 (A) | The page binds `?` and `/` as single-character shortcuts on the document, outside text fields (`apps/web/src/lib/shortcuts.ts:13-14`, `components/shortcuts.tsx`). 2.1.4 needs one of: turn off, remap with a non-printable key, or active only while the component has focus. `/` focuses the list search from anywhere on the page. Settings contain no shortcut option (grep of `settings-sections.tsx`, `settings-dialog.ts`). Candidate failure at Level A, to verify | none |
| Content on hover or focus | 1.4.13 | The ECharts tooltip, field help, hover text and popovers: dismissible without moving the pointer or focus (Escape), hoverable, persistent. `echart.tsx` has no Escape handling. The `title` attribute is excepted as user-agent content | none |
| Status messages | 4.1.3 | Run result, warnings count, "unsaved" mark, copy done, validation after typing: announced without taking focus. The photo tool has `role="status"` text. Check the workbench result region and the message slot | no rule exists |
| Names and labels | 2.5.3, 4.1.2 | Visible text inside the accessible name (`number-field.tsx:60`, `load-tabs.tsx:82` handle it); icon-only buttons; `aria-label` on role-less elements is not exposed by every screen reader | rules check presence |
| Tables | 1.3.1 | Directory tables, field tables, ladder table, lot rows and the chart table: headers, scope, caption, empty cells (`globals.css:570`), sticky headers, virtualised rows | `th-has-data-cells`, `td-headers-attr` |
| Error and help | 3.3.1, 3.3.3, 3.2.6, 3.3.7 | Schema errors in designers, invalid records list, file read errors, repeated entries between the workbench and range mode | no rules |
| Authentication | 3.3.8 | No login. Mark not applicable in the report | n/a |

## Candidate findings to verify

Not confirmed. Each needs a manual check before it becomes an issue.

1. 2.1.4: document-level `?` and `/` shortcuts with no way to turn them off or remap them (see table). If confirmed it is Level A.
2. 2.5.8: 16 px checkboxes in directory rows next to a clickable row, and any undersized control closer than the spacing exception allows.
3. 1.4.13: dismissal of the chart tooltip without moving the pointer or focus.
4. 4.1.2: a focusable `canvas` named only by `aria-label` (no role).
5. 2.5.7: drag-only paths in the photo tool and the target canvas.
6. The sweep and the contrast tests prove nothing for states they never render: record pages, open dialogs, results.

## Proposed 1.0 pass criteria

An audit "passes" for 1.0 when all of the following hold on the release candidate.

Automated, enforced in CI:

1. A11y sweep green with an empty `known` map, extended to: each `[id]` route with one fixed record, the workbench after the example run (tiles, chart, ladder, Notes), the open states of the main dialogs and popovers (Settings, Shortcuts, Chart data, Saved loads, photo tool, bullet search, site search), at 320, 390 and 1280 px, light and dark.
2. The sweep asserts `incomplete` is empty or each entry is on a reviewed list with the node and the reason, and runs `best-practice` rules as well as the WCAG tags.
3. A target size script (or the axe rule on every state above) reports no undersized target outside the five exceptions.
4. Token contrast tests remain green and gain the focus ring, input border and text pairs per surface.

Manual, recorded in the report:

5. No failure of a Level A or AA criterion of WCAG 2.2 in the structured or random sample, except items listed as documented exceptions with a reason and a workaround. Documented exceptions are limited to Article 14-style cases (fundamental alteration) and the exceptions written in the criteria themselves, and need the maintainer's signature.
6. Every complete process of the list above can be finished by keyboard alone and with a screen reader of the baseline, with no blocker.
7. Every chart and drawing has a name, a description that matches the state shown and the values available as text (table or fields).
8. No loss of content or function at 320 CSS px, at 200% text size and with the 1.4.12 spacing, apart from the excepted parts.
9. Two themes: no contrast failure for text, components, focus and chart marks.
10. A finding of severity blocker blocks the release. Majors need an issue and an entry in the accessibility page.

Project goals, not gate items: 2.3.3 reduced motion everywhere (including Mantine transitions), 2.5.5 44 px targets on phone views, a review by users of assistive technology.

Reporting: the accessibility page in the docs, with the date of the audit, baseline, sample, tool versions and the known gaps. The word "conformant" is not used; the statement says what was evaluated.

Regression guard after 1.0: the existing rule that a page missing from `sections` fails the sweep (`a11y-sweep.spec.ts:19`) stays; a new dialog or state adds its axe run to its own spec; the manual pass repeats before each minor release on the complete processes only, and in full when a component library or the theme changes.

## Unverified or not checked

- The legal reading above (medium confidence); national laws; Directive (EU) 2016/2102 beyond the recitals of the EAA.
- Whether a newer EN 301 549 than V3.2.1 exists and which edition the Official Journal cites.
- Screen reader behaviour, 1.4.13 on the ECharts tooltip, 2.5.7 on the photo tool and 2.5.8 on list checkboxes were read from code only, not run.
- The axe rule list is from the installed 4.14.0 package. The rule descriptions page of the development branch may differ.
- WCAG-EM 2.0 is a Group Note, not a Recommendation. Its 10 percent random sample size is guidance of that note.
