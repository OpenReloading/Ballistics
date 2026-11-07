# @open-reloading/design-tokens

The Brand palette (version 1) and the interface sizes as one DTCG 2025.10 source in `tokens/`, built with Terrazzo into files every surface uses: CSS variables for any page, Docusaurus and BuildGuide, typed constants and the Mantine theme. The generated files are committed, so a site needs no Node to use them. Private to this repository: it is not published.

| Export                                         | What it holds                                                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@open-reloading/design-tokens`                | `colors` per scheme, the Mantine `theme` and the `cssVariables` for Mantine's `cssVariablesResolver`                                                                                                                               |
| `@open-reloading/design-tokens/tokens.css`     | the variables (`--page`, `--ink`, `--space-md`, `--size-field`): light on `:root`; dark on `data-mantine-color-scheme="dark"` or `data-theme="dark"`, else on the system setting; the coarse-pointer sizes under `pointer: coarse` |
| `@open-reloading/design-tokens/docusaurus.css` | Infima and Pagefind on the variables; load it after `tokens.css`                                                                                                                                                                   |
| `@open-reloading/design-tokens/buildguide.css` | BuildGuide's `--ag-*` colors on the variables; load it after `tokens.css`                                                                                                                                                          |

```js
import { createTheme, MantineProvider } from '@mantine/core'
import { cssVariables, theme } from '@open-reloading/design-tokens'
import '@open-reloading/design-tokens/tokens.css'

<MantineProvider theme={createTheme(theme)} cssVariablesResolver={() => cssVariables} />
```

The UI font is Inter as `@fontsource-variable/inter` registers it (`"Inter Variable"`, every weight): a surface that uses `--font-family-ui` loads that package, or the stack falls back to the system font. Mantine's input edges and fills and its table borders read its gray and dark shades, which serve both control edges and separators; `ui` sets those per component.

Change a token in `tokens/`, then run `pnpm run generate` and commit the source with the generated `css/tokens.css` and `src/index.ts`. The tests fail when the committed files differ from the source, when a pair of `scripts/generate.ts` falls below its WCAG 2.2 contrast in either scheme, or when Mantine, the CSS variables, Docusaurus and BuildGuide show a role differently.

License: MIT
