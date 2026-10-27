# i18n architecture for the static Next.js app and the docs site

Research note for issue #273. Registry data was read on 2026-10-27. Repository facts are from `main` at the time of writing (Next.js 16.4.2, React 19.3.1, Mantine 9.7.3, Docusaurus 3.10.2).

## Answer in short

- The web app can serve a German UI under `output: 'export'` with a base path. A spike with Next.js 16.4.2 and next-intl 4.14.9 built under both editions' settings (export, `basePath`, `trailingSlash`, no Cache Components; and standalone with Cache Components and Partial Prefetching), and a browser check showed German text, German number and date formatting, and a root redirect that respects the base path.
- Static export has no proxy and no cookies, so the language has to be in the URL (`/<base>/en/...`, `/<base>/de/...`) or chosen in the browser after load. The URL route is the one that gives prerendered German HTML. It changes every existing URL and doubles the Pages site (about 300 MB today, about 600 MB with two languages, against the 1 GB soft limit).
- Recommendation: next-intl with an always-present locale prefix, English as default, one JSON catalog per language, ICU messages. The cost that decides against the alternatives is client weight: the client runtime adds about 12.7 KB gzip, which is more than the 7.5 KB of smallest headroom in `weight-budget.json`, so the budgets are raised once in the adopting pull request. If the owner will not raise them, Lingui (about 3 KB) is the alternative, with a toolchain risk described below. A plain typed dictionary is the cheapest and has the least tooling.
- Record names stay as published. Enum values shown as words, and all UI text, are translated in the web app.
- Docusaurus supports locales natively (one built site per locale under a sub path, untranslated pages fall back to the English file). German docs can start with the theme labels and move page by page.

Confidence: medium. The library measurements and the spikes are mine and small. The effort of moving about 140 client components to translated strings was not measured.

## What the repository constrains

- Export: the Pages edition builds with `output: 'export'`, `basePath`, `trailingSlash` and without Cache Components (`apps/web/next.config.ts`). The server edition builds standalone with Cache Components and Partial Prefetching. Both must work with the chosen approach.
- Unsupported in static export, per the Next.js documentation (last updated 2026-08-09): Cookies, Rewrites, Redirects, Headers, Proxy, Server Actions, and dynamic routes without `generateStaticParams()` ([Static exports](https://nextjs.org/docs/app/guides/static-exports)). The Next.js internationalization guide does the redirect to a locale in Proxy ([Internationalization](https://nextjs.org/docs/app/guides/internationalization), last updated 2026-06-10), so that part cannot be used in the Pages edition.
- Client-heavy: 139 of 185 `.tsx` files under `apps/web/src` start with `'use client'`. Messages that stay on the server (the main advantage the next-intl documentation names for Server Components) help little here, because most text is rendered by client components.
- Weight budget: `apps/web/weight-budget.json` sets each group's budget at its largest recorded route plus 2 %. Headroom per group (budget minus the largest recorded value), computed from the file: shell 8.6 KB initial and 9.6 KB total, lists 7.5 and 9.3, records 9.8 and 10.8, curve charts 8.6 and 13.2, designers 8.0 and 12.9, tools 10.7 and 12.1, workbench 17.8 and 9.1, error page 3.7 and 3.7. The smallest headroom of a normal route group is 7.5 KB initial and 9.1 KB total. `check-weight` sums JavaScript chunks only and measures the server edition only. Messages passed through a server-rendered provider land in the HTML or RSC payload, which the check does not count. Messages imported into client code are JavaScript and are counted. The budget check therefore cannot see the main cost of the provider approach.
- Offline layer: `src/lib/offline.ts` holds `shellPages` (ten paths), `offlinePage` (`/offline`) and the file list as fixed paths, and its exports are copied into `public/sw.js` without imports. The manifest uses `start_url` and `scope` of `${basePath}/`. With a locale prefix each path exists per language, and the `/offline` fallback has to know the language of the failed request.
- Plain `<a href>` links add `basePath` by hand (`src/lib/edition.ts`); `Link` and the router add it themselves. A locale prefix has the same split.
- Editions: the stable edition and the `next` edition are separate builds with their own base path. A locale prefix goes after the base path, so each edition carries its own set of language pages.
- Pages size: about 300 MB, the cartridge pages about 265 MB of it (`apps/web/AGENTS.md`, Pages edition). Limit: 1 GB soft limit for a Pages site (`apps/docs/docs/ci-tools.md`).
- Strings: a grep of attribute strings alone (`label`, `placeholder`, `title`, `description`, `aria-label`, `ariaLabel`, `message` with a capitalized literal) finds 544 in `apps/web/src`. JSX text, strings in `src/lib` and strings from the packages come on top. The total was not counted.

## Decision 1: where the language lives

| | A. Locale in the path (`/<base>/de/...`) | B. Locale chosen in the browser, one URL set |
|---|---|---|
| Prerendered German HTML | Yes | No, the HTML is English until the client switches |
| Share links, hreflang, search engines | Per language | One URL, English HTML |
| Site size | Times the number of languages | Unchanged |
| Existing URLs | All change; GitHub Pages has no redirects, so old paths need stub pages or they 404 | Unchanged |
| Server text (server components) | Translated at build | Must be rendered by client components or it stays English |
| Libraries | next-intl, Lingui, Paraglide, plain | Client-side only: Lingui, i18next, plain (next-intl's request-scoped locale needs cookies or headers, which static export lacks) |

Option A costs, each a task: every existing path (share links, bookmarks, e2e specs, `scripts/check-prerender.mts`, `src/lib/prerender-sample.ts` ids, `ci-plan.mts`, the docs `APP_URL`) gets a locale segment; `shellPages`, the manifest and the `/offline` page become per language; plain `<a href>` links add the locale; the root page needs a language choice.

What was observed for A (spike, `/tmp` scratch, not committed): the next-intl routing documentation says that under static export a proxy "will not run", that a locale prefix is required, that the locale cannot be negotiated on the server, and that `pathnames` cannot be used ([Proxy / middleware](https://next-intl.dev/docs/routing/middleware)). The spike confirmed that `app/[locale]` with `generateStaticParams`, `output: 'export'`, `basePath: '/Ballistics'` and `trailingSlash: true` builds on Turbopack and writes `out/de/index.html` with `<html lang="de">`. The root page `redirect('/en')` is not an HTML redirect: `out/index.html` carries a client-side `NEXT_REDIRECT` payload and no meta refresh. A Chromium visit to `/Ballistics/` ended on `/Ballistics/en/`. Without JavaScript nothing redirects.

## Decision 2: library

### Registry (read 2026-10-27)

| Package | Version | Licence | Peer ranges | Weight of a client entry, gzip level 9 |
|---|---|---|---|---|
| `next-intl` | 4.14.9 (modified 2026-10-02) | MIT | `next` `^12 ... ^16`, `react` includes `^19.0.0`, `@types/react` optional | 12.6 KB (esbuild), +12.7 KB in a Next build |
| `i18next` + `react-i18next` | 26.5.11 + 17.1.9 (modified 2026-10-25) | MIT | `react >= 16.8`, `i18next >= 26.2.0`, `typescript ^5 \|\| ^6 \|\| ^7` optional | 21.4 KB (esbuild) |
| `@lingui/core` + `@lingui/react` | 6.10.1 (modified 2026-10-22) | MIT | `react ^16.14 ... ^19`, `babel-plugin-macros` optional; `@lingui/swc-plugin` 6.7.1 needs `@lingui/core` 5 or 6 | 4.2 KB (esbuild), +3.0 KB in a Next build |
| `@inlang/paraglide-js` | 2.29.2 (modified 2026-10-26) | MIT | `vite >= 5`, `typescript >= 5.6`, `eslint` | not measured, see below |
| `react-intl` (reference only) | 12.1.5 | BSD-3-Clause | `react >= 18` | 15.0 KB (esbuild) |
| plain dictionary | none | none | none | own code, not measured |

Source for every row except the weights: `npm view <package>` on 2026-10-27 (registry: https://registry.npmjs.org). The unusual `react` range of next-intl (`>=19.0.0-rc <19.0.0 || ^19.0.0`) includes React 19.3.1; Next.js 16.4.2 satisfies `^16.0.0`. The latest `next` on the registry that day is 16.4.3. `react-i18next` and `i18next` accept TypeScript 7 in their optional peer range; this repository uses TypeScript 7 in the web app and 6 in the docs.

Weights: esbuild bundle of the named client exports with `react`, `react-dom` and `next` external and the `react-client` condition, minified, gzip level 9, runtime only, no catalogs. The "in a Next build" figures are the difference between the gzip level 9 sum of the JavaScript files of one exported page and the same page without the library (174,994 B plain, 187,669 B with next-intl, 178,024 B with Lingui), built with Next 16.4.2 and Turbopack. They match the esbuild numbers. They are single-page spikes, not the real app.

### Comparison

| | next-intl | Lingui | i18next + react-i18next | Paraglide JS | Plain dictionary |
|---|---|---|---|---|---|
| Static export | Documented with limits (prefix required, no proxy). Built here in both editions' settings | The RSC guide does not mention `output: 'export'`. A client-only export built here | Client-side only; Next.js and App Router not covered by the quick-start | The Next.js guide has an SSG setup, "no proxy required"; it does not use the term static export | Yes, nothing to support |
| App Router | Yes (`NextIntlClientProvider`, `getTranslations`, `setRequestLocale`, `next/root-params`) | Yes since 4.10.0; every page and layout must call `setI18n` | Not documented in the quick-start | Guide for the App Router, tested by the guide with Next 16.4.0 | Next.js guide pattern with `[lang]` and dictionaries |
| Base path | Navigation APIs and the routing configuration take `basePath` into account; `getPathname` returns the path without it. Not tested here | Not documented (unverified) | Not applicable (no routing) | Not documented (unverified) | Own code; `Link` adds it |
| Turbopack | Works (spike) | The SWC plugin built here under Turbopack with Next 16.4.2. The documentation calls the plugin "still experimental" and says plugin and `@swc/core` versions must match | No build step | The guide says the webpack plugin "requires `--webpack`" for development and builds. This repository builds with Turbopack | No build step |
| Message format | ICU (plural, selectordinal, rich text through `t.rich`) | ICU MessageFormat, catalogs in PO (JSON and CSV also), extraction by CLI | Own `{{x}}` syntax; typing options exist for ICU and MF2 (`parseInterpolation`); plurals through `Intl.PluralRules` with `_one` and `_other` keys | Plugin based: inlang format, ICU MessageFormat 1 by plugin, i18next files, JSON | Own functions; plurals through `Intl.PluralRules` |
| Numbers and dates | `useFormatter` and message arguments, on `Intl` | Number and date formatting inside messages and `i18n.number`, `i18n.date` (not read in detail, unverified) | Formatters through interpolation (not covered by the pages read, unverified) | Built on `Intl` | Direct `Intl.NumberFormat`, `Intl.DateTimeFormat` (the app already uses them) |
| Type safety | `AppConfig` augmentation checks locales, namespaces and keys; typed message arguments need the experimental `createMessagesDeclaration` and `allowArbitraryExtensions` | Message IDs are generated from the source text by a macro; "Typed Message IDs" has a page that was not read (unverified) | `CustomTypeOptions` augmentation checks keys; interpolation typing needs TypeScript or `as const` resources, not JSON; the documentation warns about slow compilation on large resource sets | "Autocomplete for message keys and parameters", typos are compile errors (per the site) | The compiler: a `de` catalog typed as the type of `en` fails on a missing key |
| Messages on the client | `NextIntlClientProvider` sends all messages by default; `messages={null}` plus narrower providers sends less; messages passed this way are emitted into the page markup | Compiled catalogs imported as modules, loaded per locale | Resources loaded by the i18n instance | Compiled to functions, unused messages tree-shaken (per the site) | Dynamic `import()` of one catalog per route or per locale |
| Extra tooling | Plugin in `next.config.ts`; install pulls `@swc/core` and `@parcel/watcher` | CLI (extract, compile), SWC or Babel macro plugin, optional ESLint plugin | None required | Compiler plugin, CLI | None |

Sources: next-intl [setup](https://next-intl.dev/docs/routing/setup), [proxy / middleware](https://next-intl.dev/docs/routing/middleware), [server and client components](https://next-intl.dev/docs/environments/server-client-components), [messages](https://next-intl.dev/docs/usage/messages), [TypeScript](https://next-intl.dev/docs/workflows/typescript), [without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing). Lingui [introduction](https://lingui.dev/introduction), [RSC tutorial](https://lingui.dev/tutorials/react-rsc), [SWC plugin](https://lingui.dev/ref/swc-plugin). i18next [plurals](https://www.i18next.com/translation-function/plurals), [TypeScript](https://www.i18next.com/overview/typescript), react-i18next [quick start](https://react.i18next.com/guides/quick-start). Paraglide [home](https://paraglidejs.com/), [Next.js guide](https://paraglidejs.com/next-js), [static site generation](https://paraglidejs.com/static-site-generation). MDN [Intl.PluralRules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules) (widely available since September 2019).

### Reading of the table

- Paraglide is out for now. Its Next.js guide requires the webpack plugin, and this repository builds with Turbopack. The Paraglide figure of "up to 70 % smaller" bundles is the project's own claim and was not checked.
- next-intl is the best documented fit for Next.js static export and the App Router, and the only one whose export and edition behavior was exercised here in both editions' configuration. Its cost is weight (12.7 KB) and that its server-side advantage is small in a client-heavy app.
- Lingui is the lightest ICU option (3.0 KB measured). Its risk is the build chain: macros need the SWC plugin, whose version must match Next.js's `@swc/core`. One build passed with Next 16.4.2; every Next.js upgrade is a new test. A no-macro mode ("experimental runtime macro that works without a build step" on the RSC page) exists and was not tried.
- i18next is the heaviest (21.4 KB) and its default message syntax is not ICU. Nothing in this app needs its plugin ecosystem.
- A plain dictionary has no weight beyond the catalogs and the best control over what a route loads. It has no ICU parser, no extraction workflow, and the project writes and maintains its own `t()`, plural and rich-text handling. For German (cardinal categories `one` and `other`) this is workable; a third language with other plural rules still works through `Intl.PluralRules` but needs more care.

## Formatting and units

- `formatNumber` in `src/lib/units.ts` forces the `en` locale with no grouping, and `src/lib/field-spec.ts` parses field text with `Number(text)`, which rejects `812,5`. Two uses need separate rules: display (German needs a comma separator) and files and share links (CSV, JSON and URLs stay locale independent).
- Mantine `NumberInput` has `decimalSeparator` and `thousandSeparator` props and no automatic locale handling ([NumberInput](https://mantine.dev/core/number-input/)). I found no Mantine page on translating component labels; labels are props of each component (unverified as a complete statement). Eleven files use `NumberInput`.
- The unit preset stays independent of the language. `localePreset` in `src/lib/units.ts` already maps a browser locale to US or metric with grains; it reads `navigator.language` and is not a language choice. German with the metric preset is the default for `de-DE`.
- Display dates and times: `src/lib/dates.ts` uses `en-GB`, `src/lib/countries.ts` uses `Intl.DisplayNames('en')` (country names would follow the language for free), and four call sites in three files use bare `toLocaleString()` or `toLocaleTimeString('en-GB')` (`file-menu.tsx`, `saved-loads.tsx`, `use-workbench-load.ts`). These go through one locale-aware formatter. The spike's German output was `812,5`, `1.234,6` and `1. Mai 2026` from `Intl` through next-intl, English `812.5`, `1,234.6`, `May 1, 2026`.
- Inch values print without the leading zero (`.308`) through `inchText`; this stays a unit convention in both languages.

## Records

Record names stay as published. `GLOSSARY.md` defines `name` as the name "as its source, rule book or user writes it", and rule-book names are often already German (federations such as DSB and BDS). `provenance.ts` fields (`title`, `publisher`, `edition`, `page`, `terms`) and target face notes are citations or source text and stay as published. Enumerations that show as words (`caseTypes`, `grainForm`, `propellantBase`, `provenanceKind`, `verification`, `sourceOrigin`) are keys, not names: their labels belong in the web app's catalogs, not in the records. No schema change, no translated fields, no data migration. Schema `.describe()` text feeds the JSON schema and the API document and stays English.

## Strings from outside the web app

Not audited. The schema, importers and API produce messages (validation errors, import reports, the REST error body). The boundary that keeps the package rules intact is that packages return codes and parameters or English developer text, and `apps/web` maps them to translated text. Packages stay free of an i18n library.

The Safety text needs a decision. `src/lib/safety.ts` is checked against `README.md` by `test/safety.test.ts`, and the README is English. A German Safety text is a separate text with its own source of truth and the owner's approval. This note does not propose its wording.

## Docusaurus docs site

- Locales are configured under `i18n` in `docusaurus.config.ts` (`defaultLocale`, `locales`, `localeConfigs` with `label`, `htmlLang`, `direction`, `baseUrl`, `url`). The default locale has no name in the base URL ([config](https://docusaurus.io/docs/api/docusaurus-config)).
- Translations live in `i18n/<locale>/<plugin>/...` as JSON for labels (`write-translations` writes them) and as whole Markdown or MDX documents for pages ([introduction](https://docusaurus.io/docs/i18n/introduction), [tutorial](https://docusaurus.io/docs/i18n/tutorial)).
- `docusaurus build` builds one site per locale (`build/` for the default, `build/de/` for German). `--locale` builds one. `docusaurus start` serves one locale at a time. Separate domains per locale are not possible on GitHub Pages (tutorial); sub paths are. The navbar item `type: 'localeDropdown'` switches locales.
- Untranslated pages: the prose pages read do not state a fallback. The source does: `getContentPathList` in `packages/docusaurus-utils/src/dataFileUtils.ts` returns the localized folder first and the original folder second, so a page without a German file renders the English one ([source](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils/src/dataFileUtils.ts), read from `main`, not from the 3.10.2 tag). Such a page sits under a German `<html lang>` with English text.
- Theme strings: the upstream package has a `de` folder with `theme-common.json` (83 lines), and some entries are still English there (for example "Toggle word wrap"). The folder list in `facebook/docusaurus` `packages/docusaurus-theme-translations/locales` includes `de`. The classic theme's own labels (navbar, footer) are in separate files written by `write-translations`.
- This site specifically: (1) the pages edition builds the docs once into `docs/` with `DOCS_BASE_URL`; with German enabled the same command writes `docs/de/` too (per the tutorial; the effect on the `--out-dir` use in `tools/src/pages.ts` was not tried) and build time roughly doubles. (2) `apps/docs/scripts/search.mts` creates its index with `forceLanguage: 'en'` and the REST records hard code `language: 'en'`. Pagefind indexes per page language from the `lang` attribute unless forced, and its UI follows the page language ([multilingual](https://pagefind.app/docs/multilingual/)), so German stemming needs both changed. Where `postBuild` writes the index per locale was not verified. (3) The TypeDoc library site and the REST page are generated outside Docusaurus and stay English. (4) The 29 model pages (about 314 KB of Markdown with formulas) are the expensive part: translate by page, the English page stays until then. (5) The web app's Docs link (`src/lib/docs-url.ts`) would point to the matching locale's folder.

## Recommendation and trade-offs

1. Language in the path (A), English default, `localePrefix: 'always'`, in both editions. The owner decides the URL change, the roughly doubled Pages size and the stub pages for old paths. A third language lands at about 900 MB and needs a plan before it is added (not prerendering record pages for it, or a different host).
2. Library: next-intl.
   - For: documented static export route, App Router support, typed keys, ICU, `Intl` based formatters, spikes pass in both editions, maintained (registry entry last modified 2026-10-02).
   - Against: about 12.7 KB gzip on every route, more than the 7.5 KB initial and 9.1 KB total of smallest group headroom. Adopting it means one pull request that raises the group budgets and records the new values, as `apps/web/AGENTS.md` allows with a stated reason. Provider messages are invisible to `check-weight`, so catalogs go through narrow providers or client imports so the check still sees them.
   - The documented server-only advantage is small here (139 of 185 files are client components).
3. If the budgets stay: Lingui, 3.0 KB measured. Trade-off: SWC plugin coupled to the Next.js version, and the experimental label. A pinned Next.js bump needs a test build each time.
4. If only English and German will ever exist and the owner prefers no dependency: a typed dictionary (`de` typed as the type of `en`), `Intl.PluralRules`, `Intl.NumberFormat`, one dynamic import per locale and route. Trade-off: a small own `t()` with plural and rich-text handling to write and keep, and no extraction tool.
5. Order of work that keeps each step reviewable: (a) locale segment and routing, redirect page, service worker and manifest paths, e2e and CI paths; (b) the formatter module (display) with the parse rule for decimal commas, `toLocale*` call sites; (c) message catalogs by route group, each with the budget check; (d) docs: theme labels, localeDropdown, search script; (e) docs pages by priority.
6. Each step ships with a Vitest check where logic exists (message key parity between catalogs, the formatter, the parse rule) and keeps e2e lean, as the repository asks.

## Unverified or not done

- Lingui and Paraglide behavior with a base path, and Lingui's formatting and typed message ID features, were not read beyond the pages cited.
- next-intl with a base path was read in documentation search snippets and exercised only in the spike's build and a Chromium visit (root redirect and `/de/`); `Link`, `useRouter` and `getPathname` under `basePath` were not run.
- The spikes are minimal (one client component, one dynamic route). Real weight depends on the catalogs, which were not written. The size of a German catalog and its effect on `check-weight` are unknown.
- Page size with a second language was computed from the documented 265 MB figure, not measured.
- The number of messages the UI needs was not counted; 544 attribute strings is a lower bound for part of it.
- Strings that originate in the packages (schema, importers, API, drawing figure text) were not audited.
- Docusaurus: the untranslated-page fallback was read in the `main` branch source, not the 3.10.2 tag; the per-locale Pagefind `postBuild` and the `--out-dir` behavior with several locales were not run.
- Mantine: no page on label localization was found in its index; the claim that labels are props is from the pages read, not exhaustive.
- Service worker behavior with several languages was reasoned from `offline.ts`, not run.
- Client-side redirect under JavaScript only: observed in Chromium through Playwright; no other browser.
