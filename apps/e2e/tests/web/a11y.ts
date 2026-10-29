import { readFileSync } from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * An axe result listed in `a11y-lists.json`: `rule` is the axe rule id, `node` a part of the node's
 * selector or markup, which follow the `data-testid` of its closest marked ancestor, `where` the start of the
 * route or state name of the sweep, or several (every one when absent).
 */
type Entry = {
  rule: string
  node: string
  where?: string | string[]
  reason: string
  workaround?: string
}

/**
 * `known`: failures not fixed yet (a violation, or a "needs review" result that review showed to
 * fail), each with its reason and the way round it. `reviewed`: "needs review" results a person has
 * read and found to pass, each with the reason.
 */
const lists: { known: Entry[]; reviewed: Entry[] } = JSON.parse(
  readFileSync(path.join(__dirname, 'a11y-lists.json'), 'utf8'),
)

/** WCAG 2.0 to 2.2 A and AA plus the best-practice rules. */
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

export const widths = [320, 390, 1280]
/** The window of a state with its own scroll boxes (the workbench, dialogs). */
export const height = 900

/** A page that scrolls: axe leaves the contrast of text below the fold as "needs review". */
export const tall = 4000

export const schemes = ['light', 'dark'] as const

const listed = (entries: Entry[], where: string, rule: string, selector: string) =>
  entries.some(
    (e) =>
      e.rule === rule &&
      (e.where === undefined || [e.where].flat().some((w) => where.startsWith(w))) &&
      selector.includes(e.node),
  )

type NodeResult = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number]['nodes'][number]

/** What the checks of a node say: the `messageKey` of a "needs review" reason, a contrast ratio, else the check ids. */
const why = (n: NodeResult) =>
  [...n.any, ...n.all, ...n.none]
    .map((c) => c.data?.messageKey ?? (c.data?.contrastRatio ? `${c.data.contrastRatio}:1` : c.id))
    .join(', ')

/**
 * Runs axe on the page (or on `include`) and gives one line per violation and per "needs review"
 * result that `a11y-lists.json` does not list, naming rule and node.
 */
export async function problems(page: Page, where: string, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(tags)
  const { violations, incomplete } = await (include ? builder.include(include) : builder).analyze()
  // a target of one selector is in the page itself, not in a frame or a shadow root
  const targets = [...violations, ...incomplete].flatMap((v) =>
    v.nodes.flatMap((n) => (n.target.length === 1 ? [String(n.target[0])] : [])),
  )
  const scopes: Record<string, string> = await page.evaluate(
    (ts) =>
      Object.fromEntries(
        ts.map((t) => [
          t,
          document.querySelector(t)?.closest('[data-testid]')?.getAttribute('data-testid') ?? '',
        ]),
      ),
    targets,
  )
  const lines = (kind: string, results: typeof violations, entries: Entry[]) =>
    results.flatMap((v) =>
      v.nodes
        .map((n) => ({
          n,
          node: `${scopes[n.target.join(' ')] ?? ''} ${n.target.join(' ')} ${n.html}`,
        }))
        .filter(({ node }) => !listed(entries, where, v.id, node))
        .map(({ n, node }) => `${where}: ${kind} ${v.id} (${why(n)}): ${node.trim()}`),
    )
  return [
    ...lines('violation', violations, lists.known),
    ...lines('review', incomplete, [...lists.reviewed, ...lists.known]),
  ]
}
