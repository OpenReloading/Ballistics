import { readFileSync } from 'node:fs'
import {
  DEFAULT_THEME,
  deepMerge,
  defaultCssVariablesResolver,
  mergeMantineTheme,
} from '@mantine/core'
import { parse } from 'postcss'
import { expect, it } from 'vitest'
import { cssVariables, theme } from '../src/index.ts'

type Scheme = 'light' | 'dark'
type Variables = Record<string, string>

/** The custom properties a page gets from `files` when the rules keyed `context` apply (`@media selector`). */
function cssOf(files: string[], context: string[]): Variables {
  const set: Variables = {}
  for (const file of files) {
    parse(readFileSync(new URL(`../css/${file}`, import.meta.url), 'utf8')).walkRules((rule) => {
      const media = rule.parent?.type === 'atrule' ? `@${rule.parent.params} ` : ''
      if (!rule.selectors.some((selector) => context.includes(`${media}${selector}`))) return
      for (const node of rule.nodes) {
        if (node.type === 'decl') set[node.prop] = node.value
      }
    })
  }
  return set
}

/** The custom properties MantineProvider sets for the theme and the resolver of the package. */
function mantineOf(scheme: Scheme): Variables {
  const resolved = deepMerge(
    defaultCssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, theme)),
    cssVariables,
  )
  return { ...resolved.variables, ...resolved[scheme] }
}

/** The value of `name` with every var() replaced, and short hex colors written out. */
function resolve(set: Variables, name: string): string | undefined {
  const value = set[name]
  return value
    ?.replace(/var\((--[\w-]+)\)/g, (_, inner: string) => resolve(set, inner) ?? 'unset')
    .replace(/^#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3')
}

const system =
  '@screen and (prefers-color-scheme: dark) :root:not([data-mantine-color-scheme], [data-theme])'
const pages: Record<Scheme, Record<'device' | 'docusaurus' | 'buildguide', string[]>> = {
  light: {
    device: [':root'],
    docusaurus: [':root', ':root[data-theme]'],
    buildguide: [':root', ':root .ag-guide'],
  },
  dark: {
    device: [':root', system],
    docusaurus: [':root', '@screen :root[data-theme="dark"]', ':root[data-theme]'],
    buildguide: [':root', system, ':root .ag-guide'],
  },
}

const steps = ['xs', 'sm', 'md', 'lg', 'xl']
/** One role per row, as Mantine, the device page (tokens.css alone), Docusaurus and BuildGuide name it. */
const roles: (string | undefined)[][] = [
  ['--mantine-color-body', '--page', '--ifm-background-color', '--ag-page'],
  ['--mantine-color-text', '--ink', '--ifm-font-color-base', '--ag-ink'],
  ['--mantine-color-bright', '--ink', '--ifm-heading-color', '--ag-text'],
  ['--mantine-color-dimmed', '--muted', '--ifm-font-color-secondary', '--ag-muted'],
  ['--mantine-color-anchor', '--link', '--ifm-link-color', undefined],
  ['--mantine-primary-color-filled', '--accent', '--ifm-color-primary', '--ag-primary'],
  ['--mantine-primary-color-filled-hover', '--accent-hover', undefined, '--ag-primary-hover'],
  ['--mantine-primary-color-light', '--accent-tint', undefined, '--ag-row-selected'],
  ['--mantine-primary-color-contrast', '--on-accent', undefined, undefined],
  ['--mantine-color-default-hover', '--surface-alt', '--ifm-hover-overlay', '--ag-control-hover'],
  [
    '--mantine-color-default-border',
    '--control-line',
    '--ifm-color-emphasis-500',
    '--ag-control-line',
  ],
  ['--mantine-color-error', '--error-text', undefined, undefined],
  [undefined, '--surface', '--ifm-background-surface-color', '--ag-surface'],
  ['--mantine-radius-default', '--radius-default', undefined, undefined],
  ...steps.map((step) => [`--mantine-spacing-${step}`, `--space-${step}`]),
  ...steps.map((step) => [`--mantine-font-size-${step}`, `--font-size-${step}`]),
  ['--mantine-font-family', '--font-family-ui', '--ifm-font-family-base', undefined],
  [undefined, '--font-family-system', undefined, '--ag-font'],
]

it.each(['light', 'dark'] as const)(
  'the Mantine theme and the CSS outputs agree in the %s scheme',
  (scheme) => {
    const page = pages[scheme]
    const surfaces = [
      mantineOf(scheme),
      cssOf(['tokens.css'], page.device),
      cssOf(['tokens.css', 'docusaurus.css'], page.docusaurus),
      cssOf(['tokens.css', 'buildguide.css'], page.buildguide),
    ]
    for (const row of roles) {
      const values = row.flatMap((name, i) =>
        name === undefined ? [] : [resolve(surfaces[i] ?? {}, name)],
      )
      expect(values, row.join(' ')).toEqual(values.map(() => values[1]))
      expect(values[1], row.join(' ')).toMatch(/^(#[0-9a-f]{6}|[\d.]+(rem|px)|.*sans-serif)$/)
    }
  },
)
