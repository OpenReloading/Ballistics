---
title: Supported browsers
description: The browsers and phone widths the web app supports, why each version is the floor, the JavaScript weight budget, and the checks that keep the code within them.
---

# Supported browsers

The web app supports these browsers and widths. An older browser may open it, but a page can fail without a message.

| Browser | Oldest version |
|---|---|
| Chrome, Edge | 111 |
| Firefox | 121 |
| Safari (macOS and iOS) | 16.4 |

- Phone widths: 320 and 390 CSS px.
- Performance: the JavaScript each route loads stays within the budgets of [`apps/web/weight-budget.json`](https://github.com/OpenReloading/Ballistics/blob/main/apps/web/weight-budget.json). There is no other performance figure.

## Why these versions

- Firefox 121: the styles use the CSS `:has()` selector ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/:has#browser_compatibility), Firefox 121). A browser without it drops each such rule, among them the phone layout of the workbench, whose readout bar could then cover the inputs. Share links also compress the load with `CompressionStream('deflate-raw')` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream#browser_compatibility), Firefox 113), and the code uses `Array.prototype.toSorted` ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted#browser_compatibility), Firefox 115).
- Safari 16.4: `CompressionStream` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream#browser_compatibility)).
- Chrome and Edge 111: the styles mix colours with CSS `color-mix()` ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix#browser_compatibility), Chrome 111).

## Checks

- `tools/test/browser-builtins.test.ts` (part of `npm test`) searches the browser code (`apps/web/src` and the sources of core, drawing, schema, api, importers and data) for built-ins one of these browsers lacks, from the MDN compatibility data, such as `URL.canParse`, `AbortSignal.any`, `Object.groupBy` or `Promise.withResolvers`. The test lists every name it checks. A use fails the test: replace it, as `anySignal` of `apps/web/src/lib/any-signal.ts` replaces `AbortSignal.any`.
- The Set methods `union`, `intersection` and `difference` are not checked, as zod's `z.union` has the same name.
- The e2e smoke spec runs in Chromium, and in Firefox and WebKit with `ALL_ENGINES` set.
