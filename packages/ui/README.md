# @open-reloading/ui

The shared interface base of the web apps: Mantine on the design tokens, with its controls sized for a fine and a coarse pointer, and Storybook with every story tested in browsers. Private to this repository: it is not published.

```js
import { UiProvider } from '@open-reloading/ui'
import '@open-reloading/ui/ui.css'

<UiProvider defaultColorScheme="auto">{app}</UiProvider>
```

`ui.css` brings Mantine's styles, the tokens of `@open-reloading/design-tokens` and the Inter font in that order, then sets Mantine's controls on the tokens: rows (`size="xs"`), bars (`size="sm"`) and the dense field of property grids (`size="field"`, 24 px) take the size tokens, which are 44 px with 16 px field text under a coarse pointer; input edges take the control-edge color; a field shows a 2 px focus ring. A Vite build resolves its package imports. `UiProvider` gives filled controls of the accent the accent's text color in each scheme, which Mantine's own contrast choice misses in the dark one.

| Command (in this folder) | What it does                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run storybook`     | the workshop on port 6006                                                                                                                                                                                                                          |
| `pnpm test`              | every story rendered on the server in Node, without a browser global; publint and Are The Types Wrong                                                                                                                                              |
| `pnpm run test:browser`  | every story as a test with axe (WCAG 2.2 AA) in Chromium at 320, 390 and 1280 px in the light, dark and forced-colors schemes and in WebKit with touch, then `storybook build`; needs the Playwright browsers (CI runs it in the Playwright image) |

A story goes in `stories/`; its `play` function holds the checks a story needs beyond axe.

License: MIT
