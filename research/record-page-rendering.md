# Record page rendering: crawlers, previews, weight

Sources read on 2026-10-27. Measurements are from a Pages edition export of `origin/main` at 5589507 (`PAGES_BASE_PATH=/Ballistics`, `PRERENDER=full`, API over the committed data bundle, `writeStaticApi` and `dropFullPayloads` applied, docs site not built), on Linux with Node 26.11 and Next 16.4.2.

## Answer in short

- Google renders JavaScript, so a record page whose content a script fetches from a data file can be indexed, but after a render queue of unspecified length. The crawlers of chat and social sites document that they read meta tags from the response, and none of the pages read says they run JavaScript, so assume a client-rendered record gives every shared link the same generic preview.
- A prerendered cartridge page set costs 464 KB on disk on average (median 495 KB): 268 MB for 577 records, 79 % of the 340 MB web export. The record's own data file is 4.4 KB (median). About 81 % of the page payload is the technical drawing as SVG element trees, laid out in both length units.
- Three of the five files written per record page are never requested by a client navigation in the tests below, and the HTML carries the payload a second time. A smaller prerendered page is possible without giving up per-record HTML.
- "Prerender only changed records" saves build time, not published bytes: the 1 GB limit counts the published site.

## Verified

Each item names its source.

### Crawlers and previews

- Googlebot processes JavaScript apps in three phases: crawling, rendering, indexing. It queues every page with a 200 status for rendering, the page "may stay on this queue for a few seconds, but it can take longer", and the rendered HTML is what it indexes. Server-side or pre-rendering "is still a great idea", partly because not all bots run JavaScript. Google can only follow `<a href>` links. For error pages in a client-rendered app it asks for a JavaScript redirect to a URL that returns 404, or a `noindex` robots meta tag added by script. https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics (last updated 2026-03-04)
- Googlebot crawls the first 2 MB of a supported file type, and each resource referenced in the HTML is fetched separately under the same limit. https://developers.google.com/search/docs/crawling-indexing/googlebot (last updated 2026-02-03). The largest exported record HTML here is 0.73 MB. Whether the 2 MB counts before or after decompression is not stated on the page (unverified).
- The rendering service does not support WebGL, clears Local Storage and Session Storage across page loads, and may ignore caching headers. https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript (last updated 2025-12-18). The drawing is SVG and the Settings unit falls back to mm, so none of these touch a record page today.
- Google ignores the content of URLs that return a 4xx status and does not index them. https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- Open Graph protocol: `og:title`, `og:type`, `og:image` and `og:url` are the four required properties, given as `<meta>` tags in the `<head>`. https://ogp.me/
- Meta's crawler (`facebookexternalhit`): "Any Open Graph properties need to be listed before the first 1 MB of your website or app, or it will be cutoff." The page says nothing on whether it runs JavaScript. https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ In the export, `og:title` sits at byte 3,507 of the largest page.
- Slackbot link expanding fetches as little of the page as it can, with HTTP Range headers, to read oEmbed, Twitter Card and Open Graph tags. The page says nothing on JavaScript. https://api.slack.com/robots
- Not confirmed: the X card crawler (the documentation URLs tried returned 402 or 404), LinkedIn, Telegram and WhatsApp. No primary source was read for them, so their JavaScript behaviour is unverified.

### Hosting and framework

- GitHub Pages: published sites may be no larger than 1 GB, deployments time out after 10 minutes, soft limits of 100 GB bandwidth a month and 10 builds an hour (the build limit does not apply to a custom Actions workflow). https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Next.js static export (page last updated 2026-08-09; the same unsupported list is in `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` of the installed 16.4.2): a dynamic route needs `generateStaticParams`, and `dynamicParams: true` is not supported. An id that was not generated has no file. Client-side fetching with a Client Component is the documented way to load data after the page. https://nextjs.org/docs/app/guides/static-exports
- Whether GitHub Pages answers a missing path with status 404 and `404.html` is not stated on the custom 404 page, which names the file and gives no status code. https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site (the status is unverified for the real host; `tools/src/pages-serve.ts` emulates 404).

### What the repository does today (file and measurement)

- `apps/web/src/app/cartridges/[id]/page.tsx` is a server component. `generateStaticParams` lists every id (`staticIds` in `apps/web/src/lib/api.ts`, which fails without the API in the Pages edition). The page builds the figure models at build time and passes `ByLengthUnit` (`apps/web/src/components/by-length-unit.tsx`, a client component) the drawing in mm and in inch. Both trees therefore travel as props in the RSC payload while the HTML renders one.
- `CartridgeDrawing` (`apps/web/src/components/cartridge-drawing.tsx`) lays out each side per unit and adds a print figure per side, so a record without variants holds 8 SVG trees in the payload: 2 sides, 2 units, screen and print.
- Page metadata is a title and a description per record (`generateMetadata`); the root layout adds one Open Graph image for the whole site (`apps/web/src/app/layout.tsx`, Pages edition only). Exported head of a record page: `og:title`, `og:description`, `twitter:card summary_large_image`, `twitter:title`, `twitter:description` per record, `og:image` the same site image for all. No canonical link, no `robots.txt`, no sitemap in the export.
- Record rows in lists are `Link`s with `prefetch={false}` (`apps/web/src/components/directory-table.tsx:637`).
- The service worker (`apps/web/src/lib/offline.ts`) precaches `shellPages` (home, tools, designers, `/offline`), the `.next/static` files and `api/catalogue/index.json`. Record pages and `api/<kind>/<id>.json` are stored on first visit (network first), so a record never opened is not available offline.
- `apps/web/weight-budget.json` budgets the server edition per route (gzip level 9 of JavaScript): `/cartridges/[id]` is recorded at 446,672 initial and 494,677 total bytes, in group `records` with budgets 466,000 initial and 515,000 total. The Pages edition is not measured by `check-weight`.

## Measured

Export of 577 cartridge records, 1,046 pages in all (static generation took 33.2 s with 8 workers on 16 threads, warm Turbopack cache).

| Item | Bytes |
| --- | --- |
| Whole web export without docs (`pages/`, 1,465 files under `api/`) | 339.5 MB |
| `cartridges/` (577 records) | 268.0 MB (79 %) |
| `disciplines/` | 47.7 MB |
| `targets/` | 9.6 MB |
| `_next/` (JavaScript, CSS, fonts) | 5.4 MB |
| `api/` (data files and catalogue) | 4.4 MB |
| every other kind together | under 4 MB |

Cartridge record files, 577 records:

| File per record | Total | Mean | Largest |
| --- | --- | --- | --- |
| `index.html` | 137.7 MB | 238 KB | 729 KB |
| `index.txt` (RSC payload, fetched on client navigation) | 65.7 MB | 114 KB | 441 KB |
| `__next.cartridges.$d$id.__PAGE__.txt` (segment) | 59.6 MB | 103 KB | 424 KB |
| `__next._index.txt`, `__next._tree.txt` (and a third small segment file where present) | 4.8 MB | 8 KB (all of them) | 7 KB (one file) |
| `api/cartridges/<id>.json` (the record) | 2.35 MB | 4.1 KB | 6.5 KB |

Median record: HTML 253 KB (gzip level 9: 42 KB), `index.txt` 122 KB (gzip 19 KB), data file 4.4 KB (gzip 1 KB). The largest record (`12`): HTML 728 KB (gzip 60 KB), `index.txt` 441 KB. The gzip figure is the transfer size where the host compresses; the 1 GB limit is on the files.

What the bytes consist of, median record `256-mag-gibbs` (`index.txt`, 122,017 B):

| Part | Bytes | Share |
| --- | --- | --- |
| SVG element trees and their path data | 99,258 | 81 % |
| Route and chunk bootstrap (stylesheets, script references) | 9,424 | 8 % |
| Everything else (tables, text, props) | 13,336 | 11 % |

The split classifies the payload rows by marker strings (an SVG element, `hi-line`, `viewBox`, `data-symbol`, or a text chunk of path data), so it is approximate; the path-data text chunks alone are 29 %. For record `12` the SVG share is 86 % (380 KB of 441 KB). The rest of the HTML is the same payload inlined as `self.__next_f.push` scripts (137 KB of 253 KB for the median record, 496 KB of 728 KB for `12`), 28 rendered SVG elements (53 KB) and the document markup. So a record page holds its drawing data three times on disk: inlined in the HTML, in `index.txt` and in the `__PAGE__` segment.

Browser check (Chromium via the e2e Playwright, the export served by `tools/src/pages-serve.ts`, service worker blocked):

- Direct load of a record: one request for the HTML (253 KB uncompressed).
- Click on a row of `/cartridges/`: one request, `4-mm-randz-court/index.txt` (75 KB). No `__PAGE__` segment and no `_tree` file of the record was requested.
- Hover and focus on 26 record links: no request for a record file (`prefetch={false}`).

The `__PAGE__` and the other segment files together are 64.4 MB (24 % of the cartridge pages). Next 16 writes them for segment prefetching; in the paths tried, none was requested. Other paths (a `Link` without `prefetch={false}` pointing at a record, `router.prefetch`) were not tried: unverified.

Client-rendered weight, measured only for the library:

- `@open-reloading/drawing` (index plus the `cartridge` entry, bundled with rolldown 1.2.15, minified, no tree shaking of unused exports): 47.5 KB, 19.3 KB gzip level 9. The record page's own drawing components (`cartridge-drawing.tsx`, 563 lines, `technical-drawing.tsx`) and the `drawable` helper are not in that number: unmeasured. The `/cartridges/[id]` route has 19,328 B of initial headroom and 20,323 B of total headroom below its group budget, so the library alone fills it before any component is counted. A budget rise, in a pull request that says why, is the stated rule.
- Data fetch and JSON reading code for the Pages edition is already in the bundle (`apps/web/src/lib/static-api.ts`).

## Options

| | A. Prerender every record (today) | B. Shell per kind, fetch the data file | C. Prerender only changed records |
| --- | --- | --- | --- |
| What a record URL is | one HTML file per record, full content | one HTML file per kind, content from `api/<kind>/<id>.json`; the per-record URL needs a query form or a 404 fallback (see below) | as A, built from a cache of earlier output |
| Published size, cartridges | 268 MB measured | about 0.1 MB shell (the designer page, a comparable shell, is 74 KB in five files) plus the 2.35 MB data files already published: about 2.4 MB, estimated | 268 MB, same as A |
| Whole web export | 339.5 MB measured, two editions 679 MB on `develop` plus docs (unmeasured) | about 75 MB per edition, estimated (340 MB minus 268 MB plus shells) | same as A |
| Variant B2: stub per record | not applicable | HTML with the record's title, description and meta, shell JavaScript, no drawing: 577 stubs at about 74 KB is about 43 MB, estimated from the designer page, not built | not applicable |
| Share link and preview | per-record title, description in the initial HTML; image is the site image for all | shell: one generic title, description and image for every record; B2: per-record text as A | as A |
| Search indexing | content is in the initial HTML, so indexing does not depend on the render queue | content only after Google's render queue; the 404 fallback gets ignored by Google; query form is one URL per record with a script-set title | as A |
| Offline | only records opened before; no way to precache 268 MB | shell and all 577 data files precachable: 0.56 MB gzip, 2.35 MB raw, measured; a navigation to `/cartridges/<id>/` offline needs the worker to answer with the shell (not built) | as A |
| Client weight | no drawing code in the browser, route at 446,672 B initial | plus at least 19.3 KB gzip (library) plus components, against 19,328 B headroom; route budget raised. The fitting-bullets count (`listAllBullets`, `bulletFits`, `cartridgeDiameters` of core, run at build time today) would need the bullet list from the precached catalogue index (64 KB gzip, already shipped) and those core functions in the bundle: unmeasured | as A |
| Build time | 33.2 s generation measured for 1,046 pages | seconds | shorter, but a change to drawing code or a component changes every page, so most builds redo all |
| Risk | the 1 GB limit as records grow | previews and indexing of 577 records lose their text; workers and offline mapping to build | the deployed artifact is a whole site: unchanged pages still count against 1 GB, and the cache of old output has to be carried between runs (unverified how) |

How option B reaches a record URL on a static host:

1. Query form, `/cartridges/record/?id=<id>`: one file, works under any static host, one canonical URL per record by query. The initial HTML has one title for all, script sets the rest.
2. Path form, `/cartridges/<id>/`: Next needs `generateStaticParams`, so an id that was not generated has no file. The route can serve the shell from `404.html` for any missing path, but that response carries status 404 on a local emulation and (unverified) on GitHub Pages, Google ignores the content of 4xx URLs, and existing share links would answer 404 to every crawler.
3. Stub per record (B2): keeps every path form and per-record meta, and the stub's body renders from the data file. This is the only B variant that keeps previews per record and the current URLs.

## Smaller prerendered pages (option A without the weight)

Estimated from the measurements; none built.

- Do not emit the 64.4 MB of segment files no tested path requests. Saving 24 % of the cartridge pages; correctness depends on the unverified prefetch paths above.
- Lay out one unit in the payload and draw the other from the geometry in the browser: removes about half of the 81 % SVG share from the payload, costs the 19.3 KB gzip library, and the page then shows the unit it was prerendered with until script runs, which the page does today for mm.
- The HTML repeats its payload as scripts; that is how Next 16 streams the initial render. No documented switch to drop it was found (unverified).

## Consequences

- 1 GB limit: today one edition is 340 MB without docs and the cartridges are 79 % of it. On `develop` (the stable plus next deployment, not yet on `main`, which deploys one edition), `pages.yml` builds a stable and a next edition into one deployment, so the web exports alone are about 680 MB (double of 339.5 MB) before docs, 68 % of the limit. Both editions carry every record page, so each increment counts twice: one more kind of record pages of cartridge size would bring the two exports to about 1.2 GB, over the limit, and a cartridge set 1.5 times larger to about 950 MB, before docs. Under B or B2 the same two-edition layout is about 150 MB to 230 MB before docs (estimated).
- Share links and link previews: only A and B2 give a record its own preview text. Previews today still show the same image for every record (`og:image`), a separate gap from this question.
- Offline: only B (either variant) allows all records to be available after the first visit; A offers what was opened before.
- Indexing: there is no sitemap, `robots.txt` or canonical link in the export today, whichever option is chosen; Google follows only `<a href>` links, and the record rows are `Link`s.
- Option C does not address size, offline or previews.

## Unverified and unmeasured

- JavaScript execution of Slackbot, Meta, X, LinkedIn, Telegram and WhatsApp crawlers: no page read states it.
- The HTTP status GitHub Pages sends with `404.html`; whether the 1 GB limit is on files or the compressed artifact.
- Whether the segment files of record pages are requested by any path other than the three tried.
- Size of the docs site, so the total of the deployed site.
- Gzip weight of the record components in the browser; the 19.3 KB figure is the drawing library only.
- Sizes of option B and B2 pages: estimated from a comparable page, no shell or stub was built.
- Google's index latency for client-rendered pages: the documentation gives no figure.
