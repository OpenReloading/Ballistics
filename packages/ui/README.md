# @open-reloading/ui

The shared interface base of the web apps: Mantine on the design tokens, with its controls sized for a fine and a coarse pointer, and Storybook with every story tested in browsers. Private to this repository: it is not published.

```js
import { setupI18n } from '@lingui/core'
import { UiProvider, uiMessages } from '@open-reloading/ui'
import '@open-reloading/ui/ui.css'

const i18n = setupI18n({ locale: 'de', messages: { de: { ...uiMessages.de, ...appMessages.de } } })

<UiProvider i18n={i18n} defaultColorScheme="auto">{app}</UiProvider>
```

The frame of an app: `AppFrame` holds the top bar (menu button below 75em, brand, end actions, an `account` slot that only a surface with accounts fills), the main navigation (an icon rail from 75em; below it a drawer the menu button opens, which keeps the focus inside, closes on Escape or a followed link and gives the focus back to the menu button) and the page, with a gutter; `PageBar` starts the page with its only `h1`, a status line that is a live region and the actions; `NavItem` is a navigation link with a Lucide icon (`lucide-react` is a peer dependency: the app imports the icons) that takes anchor props, so a router wraps it (TanStack Router's `createLink(NavItem)`). Their labels are `ui`'s own messages.

The rows behind a table come from a `DataSource`: a query of TanStack Table's column filters and sorting with a range of rows returns those rows and how many match in all. `arraySource` answers from rows in memory; the device's index and the catalog read in chunks implement the same interface, and `test/data-source-contract.ts` holds the behavior each one must pass. Text sorts by one collation (`Intl.Collator('en', { numeric: true })`), numbers before text, so every source pages the same rows.

Messages: `ui` takes the app's Lingui `i18n` (`UiProvider i18n={i18n}`), into which the app loads `uiMessages[locale]` beside its own catalog; the app activates a locale before it renders, since Lingui's provider renders nothing until one is active. `ui`'s messages use the runtime API with explicit ids (`i18n._({ id, message })`), since `tsc` builds it and transforms no macros; `pnpm run messages` extracts them into `src/locales/*.po` (English from the code, German by hand), and the build compiles them with `lingui compile --strict`, which fails on a missing German message. An id the English catalog lacks fails `tsc -p test`: `test/lingui.d.ts` registers ui's ids for its own code (`test/message-ids.ts` holds the check), and an app registers the union of its ids and ui's in its own code. The catalogs compile in `build` (and before `storybook`); run the build after editing a PO file.

`ui.css` brings Mantine's styles, the tokens of `@open-reloading/design-tokens` and the Inter font in that order, then sets Mantine's controls on the tokens: rows (`size="xs"`), bars (`size="sm"`) and the dense field of property grids (`size="field"`, 24 px) take the size tokens, which are 44 px with 16 px field text under a coarse pointer; input edges take the control-edge color; a field shows a 2 px focus ring; the marks of a checked box or radio take the accent's text color, and an unchecked one shows a control edge on the page color. A Vite build resolves its package imports. `UiProvider` gives filled controls of the accent the accent's text color in each scheme (Mantine's own is white, 2.5:1 on the dark accent). It takes only the color-scheme props: Mantine's theme, class-name and variable props would undo `ui.css` or the tokens.

| Command (in this folder) | What it does                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run storybook`     | the workshop on port 6006                                                                                                                                                                                                                                                      |
| `pnpm test`              | every story rendered on the server in Node, without a browser global; publint and Are The Types Wrong                                                                                                                                                                          |
| `pnpm run test:browser`  | every story as a test with axe (WCAG 2.2 AA) in Chromium at 320, 390 and 1280 px in the light scheme and at 390 px in the dark and forced-colors schemes, and in WebKit with touch; then `storybook build`; needs the Playwright browsers (CI runs it in the Playwright image) |

A story goes in `stories/`; its `play` function holds the checks a story needs beyond axe.

License: MIT
