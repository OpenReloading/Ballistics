# @open-reloading/ui

The shared interface base of the web apps: Mantine on the design tokens, with its controls sized for a fine and a coarse pointer, and Storybook with every story tested in browsers. Private to this repository: it is not published.

```js
import { UiProvider } from '@open-reloading/ui'
import '@open-reloading/ui/ui.css'

<UiProvider defaultColorScheme="auto">{app}</UiProvider>
```

The frame of an app: `AppFrame` holds the top bar (menu button below 75em, brand, end actions, an `account` slot that only a surface with accounts fills), the main navigation (an icon rail from 75em, a panel the menu button opens below it) and the page; `PageBar` starts the page with its only `h1`, a status line that is a live region and the actions; `NavItem` is a navigation link with a Lucide icon that takes anchor props, so a router wraps it (TanStack Router's `createLink(NavItem)`). Labels come in the page's language.

`ui.css` brings Mantine's styles, the tokens of `@open-reloading/design-tokens` and the Inter font in that order, then sets Mantine's controls on the tokens: rows (`size="xs"`), bars (`size="sm"`) and the dense field of property grids (`size="field"`, 24 px) take the size tokens, which are 44 px with 16 px field text under a coarse pointer; input edges take the control-edge color; a field shows a 2 px focus ring; the marks of a checked box or radio take the accent's text color, and an unchecked one shows a control edge on the page color. A Vite build resolves its package imports. `UiProvider` gives filled controls of the accent the accent's text color in each scheme (Mantine's own is white, 2.5:1 on the dark accent). It takes only the color-scheme props: Mantine's theme, class-name and variable props would undo `ui.css` or the tokens.

| Command (in this folder) | What it does                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run storybook`     | the workshop on port 6006                                                                                                                                                                                                                                                      |
| `pnpm test`              | every story rendered on the server in Node, without a browser global; publint and Are The Types Wrong                                                                                                                                                                          |
| `pnpm run test:browser`  | every story as a test with axe (WCAG 2.2 AA) in Chromium at 320, 390 and 1280 px in the light scheme and at 390 px in the dark and forced-colors schemes, and in WebKit with touch; then `storybook build`; needs the Playwright browsers (CI runs it in the Playwright image) |

A story goes in `stories/`; its `play` function holds the checks a story needs beyond axe.

License: MIT
