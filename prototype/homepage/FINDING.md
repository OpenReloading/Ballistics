# Homepage: layout variants, news and recently added records (#290)

Throwaway branch `prototype/homepage`, never merged, no pull request. Fake news items and fake saved loads only.

## Pick

**Variant B**: keep the Tools and Library cards, add a one-line Continue strip above them (the three most recently saved loads of this browser) and a What's new list below them. The strip keeps its height while the store is read and shows a one-line hint when nothing is saved, so the page never shifts. The owner may overrule the pick; build issues use B meanwhile.

One deviation from the refined spec: the spec says "hidden when the browser holds none" and also "no layout shift when the strip fills". Both cannot hold. Collapsing an empty strip shifts the page by 0.036 (1280 px) and 0.120 (390 px) CLS for a first visit, so the strip stays and shows a hint.

## Variants (wireframes)

```
A (shipped)               B (pick)                      C (workbench first)
+---------------------+   +---------------------+       +---------------------+
| lead line           |   | Continue: l1 l2 l3  |       | lead line           |
| Tools: 3 cards      |   | lead line           |       | [Open workbench]    |
| Library: Database   |   | Tools: 3 cards      |       |  Session  Groups    |
+---------------------+   | Library: Database   |       | Continue: l1 l2 l3  |
                          | What's new (5)      |       | What's new (5)      |
                          +---------------------+       | Library: Database   |
                                                        +---------------------+
```

Rendered on one route: `/prototype-home/?v=A|B|C` (`?collapse=1` lets the strip give its height back, to measure the shift). Screenshots in `screens/` (`<variant>-<size>.png` is the window, `-full` the whole page; light theme, strip filled with three of four fake loads). Raw numbers: `measurements.json`.

## Measurements

Chromium in the dev container, served static export, strip filled from IndexedDB (three newest of four fake loads) or empty. Script: `apps/e2e/scripts/homepage-measure.mts`.

| Rule | A | B | C |
|---|---|---|---|
| Workbench button bottom, 1280 x 650 (window 650) | 269 | 325 | 156 |
| Workbench button bottom, 390 x 844 (window 844) | 289 | 397 | 174 |
| CLS, strip filled or empty with reserved height, 1280 / 390 | 0 / 0 | 0 / 0 | 0 / 0 |
| CLS, empty strip collapsed (alternative), 1280 / 390 | n/a | 0.036 / 0.120 | 0.030 / 0.096 |
| Blocks in DOM order = visual order, focusable links in block order | yes | yes | yes |
| What's new starts at y (1280 / 390) | none | 728 / 1064 | 231 / 349 |
| Page height, 1280 / 390 (px) | 654 / 950 | 1060 / 1585 | 924 / 1262 |
| JS initial / total, gzip 9 (B) | 416834 / 464312 | 420910 / 468388 | at most 421728 / 469206 |

C's weight is the bound of the route holding all three variants (`/prototype-home`): C adds no client component of its own. Budget of group `shell` in `apps/web/weight-budget.json`: 424000 initial, 472000 total.

- **News adds no client chunk**: route `/prototype-home-news` (shipped home plus the news panel as a server component) has exactly the chunk set of `/` (416834 / 464312, same files).
- **The Continue strip costs 4076 B initial and 4076 B total** (B against `/`, both measured in this build).
- Headroom left with B: 3090 B initial, 3612 B total against the budget. Measured `/` here is 416834 B, the value recorded in `weight-budget.json` is 414851 B, so against the recorded value B adds 6059 B; the headroom of "about 9 KB" in the spec is about 7.2 KB measured here before the strip.
- Not measured: dark theme, German text, axe, a screen reader.

## Rule applied

1. No first-screen loss of the workbench entry: A, B, C pass (button inside both windows).
2. Weight within the budget: B and C pass; the strip is a client component and uses 4076 B of 7166 B of headroom.
3. No layout shift when the strip fills: A, B, C pass with the reserved height; the collapsing alternative fails.
4. Keyboard order equals visual order: A, B, C pass.
5. Tie goes to the smaller change: B (two added blocks, cards unchanged) over C (tool cards replaced by links, page reordered).

## Answers

| Question | Answer |
|---|---|
| Layout | B |
| Where news lives | `apps/web/news/YYYY-MM-DD-slug.md`, read at build by the server page, newest five, no client JavaScript |
| Who decides "big" | the pull request that adds a user-visible feature adds the item, reviewed like any file; one line in `CONTRIBUTING.md` |
| Offline | the news is in the prerendered page, so it works offline with the page; the strip reads IndexedDB and needs no network |
| Heading text | the server component cannot call `t`; build issue 1 passes the translated heading from the client `Home` or a message the server page translates |

### Recently added, per kind

| Kind | Date field it would read | Verdict |
|---|---|---|
| Loads | `saved` (ISO time of the last save, `base` in `packages/schema/src/user-data.ts`) | the Continue strip, personal, no catalogue widget |
| Bullets | none (`retrieved` in `packages/schema/src/provenance.ts` is a source's retrieval date, not the date the record was added) | no widget; revisit when real components exist |
| Powders | none, as for bullets | no widget |
| Cartridges | none | none |
| Federations | none | none |

A date taken from git history is rejected: heavy and fragile.

## News item and build step output

`apps/web/news/2026-10-27-example-item-six.md`:

```
---
title: Example item six
link: /workbench
---
This is an invented sentence for the prototype. It is the newest of six fake items.
```

`newestNews(5)` (`apps/web/src/lib/prototype-news.ts`) lists the folder, sorts the names (the date leads), keeps the newest five and returns, newest first:

```
{ date: '2026-10-27', slug: 'example-item-six', title: 'Example item six',
  href: '/workbench', text: 'This is an invented sentence ... fake items.' }
```

A file name that is not `YYYY-MM-DD-slug.md`, or a file without title, link and text, throws, so the build fails. The text is the two sentences. `NewsPanel` (`apps/web/src/components/prototype-news.tsx`) renders it as a `Panel` with a list.

## Build issue drafts (each one pull request)

1. **Home: What's new from `apps/web/news/`.** The loader with its test (order, the newest five, a malformed file fails the build), the server component under the cards, the heading translated, the rule in `CONTRIBUTING.md`, no real news text beyond a first item the owner approves. Acceptance: `npm run check-weight -w @open-reloading/web` shows `/` unchanged in files and bytes; the export's home HTML lists the items newest first.
2. **Home: Continue strip.** The strip above the cards with the three newest saved loads (`saved`), reserved height with a hint when empty, a link that opens the load in the workbench through the open-loads store, German text. Acceptance: Playwright at 1280 x 650 and 390 x 844 with a seeded store and an empty one: layout shift 0, the workbench button in the window, axe clean in light and dark; the `shell` budget holds without a rise (the strip costs about 4.1 kB).
3. **Docs: the news rule.** Where news lives and who writes it, in `apps/docs/docs/release.md` next to the changelogs. Acceptance: `npm test -w @open-reloading/docs` and the link check pass. Optional, may join issue 1.

## Graduation

This answers the open questions of #216 (place and format of news, "recently added" per kind, offline, weight). Proposal: close #216 as graduated to #290 and the build issues above. Nothing is closed by this work.

## Prototype files

`apps/web/src/app/prototype-home*/`, `apps/web/src/app/prototype-home.css`, `apps/web/src/components/prototype-*.tsx`, `apps/web/src/lib/prototype-news.ts`, `apps/web/news/`, `apps/e2e/scripts/homepage-measure.mts`. The shipped home page and `weight-budget.json` are untouched.
