import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_THEME } from '@mantine/core'
import {
  build,
  type ConfigInit,
  defineConfig,
  Logger,
  lintRunner,
  type Plugin,
  parse,
  type Resolver,
  type TokenNormalized,
  type TokenNormalizedSet,
} from '@terrazzo/parser'
import css from '@terrazzo/plugin-css'

const root = new URL('../', import.meta.url)
const source = new URL('tokens/resolver.json', root)

/** Mantine and Docusaurus mark the dark scheme on the root element; a page with neither follows the system. */
const darkScheme = ':root[data-mantine-color-scheme="dark"], :root[data-theme="dark"]'
const systemScheme = ':root:not([data-mantine-color-scheme], [data-theme])'

/** WCAG 2.2 pairs, checked in each scheme: text at 4.5:1, and at 3:1 (`largeText`) the control edges and the accent as a focus ring and a checked fill, which axe does not see. */
const contrastPairs = [
  ...[
    ['ink', 'page'],
    ['ink', 'surface'],
    ['ink', 'surface-alt'],
    ['ink', 'accent-tint'],
    ['muted', 'page'],
    ['muted', 'surface'],
    ['muted', 'surface-alt'],
    ['link', 'page'],
    ['link', 'surface'],
    ['link', 'surface-alt'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
    ['warn-text', 'warn-fill'],
    ['error-text', 'page'],
    ['error-text', 'surface'],
  ].map(([fg, bg]) => ({ foreground: `color.${fg}`, background: `color.${bg}` })),
  ...[
    ['control-line', 'page'],
    ['control-line', 'surface'],
    ['accent', 'page'],
    ['accent', 'surface'],
  ].map(([fg, bg]) => ({ foreground: `color.${fg}`, background: `color.${bg}`, largeText: true })),
]

/** Terrazzo lints the default context only, so this runs the configured rules on every context. */
function lintEveryContext(): Plugin {
  let config: ConfigInit
  return {
    name: 'lint-every-context',
    config(init) {
      config = init
    },
    async build({ resolver, sources, context }) {
      const inputs = resolver.listPermutations?.()
      if (inputs === undefined) throw new Error('the resolver lists no contexts to lint')
      for (const input of inputs) {
        try {
          await lintRunner({
            tokens: resolver.apply(input),
            config,
            sources,
            logger: context.logger,
          })
        } catch (error) {
          throw new Error(`${JSON.stringify(input)}: ${String(error)}`, { cause: error })
        }
      }
    },
  }
}

/** The hex of an sRGB color token, which must equal its `hex`: the contrast lint reads the components, the outputs the hex. */
function colorHex(token: TokenNormalized & { $type: 'color' }): string {
  const { colorSpace, components, hex } = token.$value
  const fromComponents = `#${components
    .map((c) =>
      Math.round(Number(c) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
  if (colorSpace !== 'srgb' || hex !== fromComponents)
    throw new Error(
      `${token.id}: hex ${hex} is not its ${colorSpace} components (${fromComponents})`,
    )
  return hex
}

/** The CSS value of a resolved token: a color as its hex, a dimension with its unit, a font stack as one list. */
function cssValue(token: TokenNormalized): string {
  switch (token.$type) {
    case 'color':
      return colorHex(token)
    case 'dimension':
      return `${token.$value.value}${token.$value.unit}`
    case 'fontFamily':
      return token.$value.map((name) => (name.includes(' ') ? `"${name}"` : name)).join(', ')
    case 'fontWeight':
    case 'number':
      return String(token.$value)
    default:
      throw new Error(`${token.id}: no CSS value for type ${token.$type}`)
  }
}

/** The values of the tokens below `group`, by the rest of their id. */
function values(tokens: TokenNormalizedSet, group: string): Record<string, string> {
  return Object.fromEntries(
    Object.values(tokens)
      .filter((token) => token.id.startsWith(`${group}.`))
      .map((token) => [token.id.slice(group.length + 1), cssValue(token)]),
  )
}

const steps = ['xs', 'sm', 'md', 'lg', 'xl'] as const

type Colors = Record<'light' | 'dark', Record<string, string>>

/** The shade of Mantine's blue that the accent `hex` is. */
function blueShade(hex: string | undefined): number {
  const index = DEFAULT_THEME.colors.blue.indexOf(hex ?? '')
  if (index < 0)
    throw new Error(`accent ${hex} is no shade of Mantine's blue; the theme needs own colors`)
  return index
}

/** The Mantine theme: Mantine's own blue at the accent's shades, sizes and fonts from the tokens. */
function mantineTheme(tokens: TokenNormalizedSet, colors: Colors) {
  const value = (id: string) => {
    const token = tokens[id]
    if (token === undefined) throw new Error(`no token ${id}`)
    return cssValue(token)
  }
  const heading = (h: string) => ({
    fontSize: value(`font.heading.${h}.size`),
    fontWeight: value(`font.heading.${h}.weight`),
    lineHeight: value(`font.heading.${h}.line-height`),
  })
  return {
    fontFamily: value('font.family.ui'),
    fontSizes: Object.fromEntries(steps.map((step) => [step, value(`font.size.${step}`)])),
    spacing: Object.fromEntries(steps.map((step) => [step, value(`space.${step}`)])),
    radius: Object.fromEntries(steps.map((step) => [step, value('radius.default')])),
    headings: {
      fontFamily: value('font.family.ui'),
      sizes: { h1: heading('h1'), h2: heading('h2'), h3: heading('h3') },
    },
    primaryColor: 'blue',
    primaryShade: {
      light: blueShade(colors.light['accent']),
      dark: blueShade(colors.dark['accent']),
    },
    // no autoContrast: Mantine picks its text from the light shade in both schemes; the scheme's accent text is --mantine-primary-color-contrast (below), which `ui` gives the filled controls
    white: colors.light['on-accent'],
    black: colors.dark['on-accent'],
  }
}

/** By the token role each takes; the input edges and fills and the table borders read Mantine's gray and dark shades, which mix control edges and separators, so `ui` sets those. */
const mantineRoles = {
  '--mantine-color-body': 'page',
  '--mantine-color-text': 'ink',
  '--mantine-color-bright': 'ink',
  '--mantine-color-dimmed': 'muted',
  '--mantine-color-placeholder': 'muted',
  '--mantine-color-anchor': 'link',
  '--mantine-color-default': 'page',
  '--mantine-color-default-hover': 'surface-alt',
  '--mantine-color-default-color': 'ink',
  '--mantine-color-default-border': 'control-line',
  '--mantine-color-error': 'error-text',
  '--mantine-primary-color-contrast': 'on-accent',
  // Mantine's hover and tint of the primary color are other shades of its blue than the accent's
  '--mantine-color-blue-filled-hover': 'accent-hover',
  '--mantine-color-blue-light': 'accent-tint',
}

/** The Mantine CSS variables of one scheme, from its colors by role. */
function mantineScheme(colors: Record<string, string>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(mantineRoles).map(([name, role]) => [name, colors[role]]),
  )
}

function moduleSource(resolver: Resolver): string {
  const light = resolver.apply({ theme: 'light' })
  const colors = {
    light: values(light, 'color'),
    dark: values(resolver.apply({ theme: 'dark' }), 'color'),
  }
  return [
    '// Generated by scripts/generate.ts from tokens/ (pnpm run generate): do not edit.',
    '',
    '/** The colors of the light and the dark scheme, by role. */',
    `export const colors = ${JSON.stringify(colors, null, 2)} as const`,
    '',
    "/** The Mantine theme of the tokens, for Mantine's `createTheme`. */",
    `export const theme = ${JSON.stringify(mantineTheme(light, colors), null, 2)} as const`,
    '',
    '/** The scheme colors Mantine derives from its own palette, set to the tokens: for `cssVariablesResolver`. */',
    `export const cssVariables = ${JSON.stringify({ variables: {}, light: mantineScheme(colors.light), dark: mantineScheme(colors.dark) }, null, 2)} as const`,
    '',
  ].join('\n')
}

/** Writes `src/index.ts`, the values as typed constants with the Mantine theme. */
function moduleOutput(): Plugin {
  return {
    name: 'design-tokens-module',
    build({ resolver, outputFile }) {
      outputFile('src/index.ts', moduleSource(resolver))
    },
  }
}

const cssOutput = css({
  filename: 'css/tokens.css',
  legacyHex: true,
  // the colors keep Brand's names (--page, --ink); every other token is named by its id (--space-md)
  variableName: (token) => `--${token.id.replace(/^color\./, '').replaceAll('.', '-')}`,
  permutations: [
    {
      input: { theme: 'light', density: 'fine' },
      prepare: (body) => `:root {\n  color-scheme: light;\n  ${body}\n}`,
    },
    {
      input: { theme: 'dark', density: 'fine' },
      include: ['color.**'],
      exclude: ['color.select'],
      prepare: (body) => `${darkScheme} {\n  color-scheme: dark;\n  ${body}\n}`,
    },
    {
      input: { theme: 'dark', density: 'fine' },
      include: ['color.**'],
      exclude: ['color.select'],
      prepare: (body) =>
        `@media (prefers-color-scheme: dark) {\n  ${systemScheme} {\n    color-scheme: dark;\n    ${body}\n  }\n}`,
    },
    {
      input: { theme: 'light', density: 'coarse' },
      include: ['size.**', 'font.size.field'],
      prepare: (body) => `@media (pointer: coarse) {\n  :root {\n    ${body}\n  }\n}`,
    },
  ],
})

/** The generated files, `css/tokens.css` and `src/index.ts`, from the DTCG source in `tokens/`. */
export async function outputs(): Promise<{ filename: string; contents: string }[]> {
  const logger = new Logger({ level: 'warn' })
  const config = defineConfig(
    {
      tokens: ['./tokens/resolver.json'],
      outDir: './',
      lint: { rules: { 'a11y/min-contrast': ['error', { level: 'AA', pairs: contrastPairs }] } },
      plugins: [lintEveryContext(), cssOutput, moduleOutput()],
    },
    { cwd: root, logger },
  )
  const { tokens, resolver, sources } = await parse(
    [{ src: readFileSync(source, 'utf8'), filename: source }],
    { config, logger, skipLint: true },
  )
  const { outputFiles } = await build(tokens, { resolver, sources, config, logger })
  return outputFiles.map(({ filename, contents }) => ({ filename, contents: String(contents) }))
}

if (import.meta.main) {
  for (const { filename, contents } of await outputs()) {
    const file = new URL(filename, root)
    mkdirSync(new URL('.', file), { recursive: true })
    writeFileSync(file, contents)
  }
}
