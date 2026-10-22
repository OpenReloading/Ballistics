/** Report issue: the area of a page, the record it shows, and the prefilled new-issue link of the repository. */
import type { TargetSheet } from '@openreloading/schema'
import type { FederationData } from './face-disciplines.ts'

/** Areas of the app, the second part of a report title. */
export const reportAreas = [
  'Workbench',
  'Shot groups',
  'Session summary',
  'Cartridges',
  'Bullets',
  'Powders',
  'Targets',
  'Disciplines',
  'Federations',
  'Firearms',
  'Cartridge designer',
  'Bullet designer',
  'Settings',
  'Other',
] as const
export type ReportArea = (typeof reportAreas)[number]

export const reportTypes = ['Bug', 'Wrong data', 'Idea'] as const
export type ReportType = (typeof reportTypes)[number]

/** The dialog's label of the report text. */
export const reportQuestion = (type: ReportType) =>
  type === 'Idea' ? 'What do you need?' : 'What happened?'

/** Longest link: GitHub and browsers refuse longer ones. */
export const maxReportChars = 7000

// designers before their lists
const areaRoutes: [string, ReportArea][] = [
  ['/workbench', 'Workbench'],
  ['/groups', 'Shot groups'],
  ['/session', 'Session summary'],
  ['/cartridges/designer', 'Cartridge designer'],
  ['/bullets/designer', 'Bullet designer'],
  ['/cartridges', 'Cartridges'],
  ['/bullets', 'Bullets'],
  ['/powders', 'Powders'],
  ['/targets', 'Targets'],
  ['/disciplines', 'Disciplines'],
  ['/federations', 'Federations'],
  ['/firearms', 'Firearms'],
]

const under = (route: string, path: string) => route === path || route.startsWith(`${path}/`)

/** The area of a route; Settings has no route (a dialog), so the dialog offers it. */
export const reportArea = (route: string): ReportArea =>
  areaRoutes.find(([path]) => under(route, path))?.[1] ?? 'Other'

const recordKinds: Record<string, string> = {
  cartridges: 'cartridge',
  bullets: 'bullet',
  powders: 'powder',
  targets: 'target face',
  disciplines: 'discipline',
  federations: 'federation',
}

/** The record kind and id of a record page's route, else undefined. */
export function reportRecord(route: string): { kind: string; id: string } | undefined {
  const [, list, id, more] = route.split('/')
  if (!recordKinds[list] || !id || more !== undefined) return
  if (['designer', 'compare', 'burn-rates'].includes(id)) return
  try {
    return { kind: recordKinds[list], id: decodeURIComponent(id) }
  } catch {
    return { kind: recordKinds[list], id }
  }
}

/** What every report carries about the page and the browser. */
export type ReportContext = {
  path: string
  title: string
  record?: { kind: string; id: string; name?: string }
  version: string
  edition: 'server' | 'Pages'
  userAgent: string
  window: string
  colourScheme: string
  units: string
}

/** A ticked block of page data: its heading and Markdown text. */
export type ReportBlock = { heading: string; text: string }

export type Report = {
  area: ReportArea
  type: ReportType
  what: string
  context: ReportContext
  blocks: ReportBlock[]
}

/** "Report: <area>: <type>: " and the first line of `what`, else the page title. */
export function reportTitle(r: Pick<Report, 'area' | 'type' | 'what' | 'context'>) {
  const line = Array.from(r.what.trim().split('\n')[0].trim() || r.context.title)
  return `Report: ${r.area}: ${r.type}: ${line.length > 100 ? `${line.slice(0, 99).join('')}…` : line.join('')}`
}

const contextLines = (r: Report) => {
  const c = r.context
  return [
    `- Type: ${r.type}`,
    `- Area: ${r.area}`,
    `- Page: ${c.path} (${c.title})`,
    ...(c.record
      ? [
          `- Record: ${c.record.kind} \`${c.record.id}\`${c.record.name ? `, ${c.record.name}` : ''}`,
        ]
      : []),
    `- Version: ${c.version}`,
    `- Edition: ${c.edition}`,
    `- Browser: ${c.userAgent}`,
    `- Window: ${c.window}`,
    `- Colour scheme: ${c.colourScheme}`,
    `- Units: ${c.units}`,
  ]
}

/** The issue form of a report, in `.github/ISSUE_TEMPLATE/`. */
export const reportTemplate = 'user-report.yml'

/** The form's text fields by id, with their labels. */
export const reportFieldLabels = { what: 'What happened', context: 'Context', data: 'Data' }
export type ReportFields = Record<keyof typeof reportFieldLabels, string>

/** The form's text fields: the text, Context with `notes` after it, the ticked blocks. */
export function reportFields(r: Report, notes: string[] = []): ReportFields {
  return {
    what: r.what.trim(),
    context: [...contextLines(r), ...(notes.length ? ['', ...notes] : [])].join('\n'),
    data: r.blocks.map((b) => `#### ${b.heading}\n\n${b.text}`).join('\n\n'),
  }
}

/** The new-issue link of the form with title, dropdowns and text fields, under `maxReportChars`. */
export function reportUrl(repository: string, r: Report): string {
  // encodeURIComponent throws on a lone surrogate in pasted text (toWellFormed is not in Firefox 111)
  const wellFormed = (s: string) => s.replace(/\p{Cs}/gu, '\uFFFD')
  const link = (fields: ReportFields) => {
    const query = Object.entries({
      template: reportTemplate,
      title: reportTitle(r),
      'report-type': r.type,
      area: r.area,
      ...fields,
    })
      .map(([k, v]) => `${k}=${encodeURIComponent(wellFormed(v))}`)
      .join('&')
    return `${repository.replace(/\/+$/, '')}/issues/new?${query}`
  }
  // the blocks go first, last ticked first, then the text is cut
  const notes: string[] = []
  const blocks = [...r.blocks]
  let url = link(reportFields(r, notes))
  while (url.length > maxReportChars && blocks.length > 0) {
    const left = blocks.pop() as ReportBlock
    notes.push(
      `${left.heading} left out: the link would be longer than ${maxReportChars} characters.`,
    )
    url = link(reportFields({ ...r, blocks }, notes))
  }
  if (url.length <= maxReportChars) return url
  const cut = `The text was cut: the link would be longer than ${maxReportChars} characters.`
  // cut on code points, a cut inside a surrogate pair leaves half an emoji
  const what = Array.from(r.what)
  const cutTo = (n: number) =>
    link(reportFields({ ...r, what: what.slice(0, n).join(''), blocks }, [...notes, cut]))
  let lo = 0
  let hi = what.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (cutTo(mid).length <= maxReportChars) lo = mid
    else hi = mid - 1
  }
  return cutTo(lo)
}

/** The text fields a report link fills, each under its label. */
export function reportSent(url: string) {
  const query = new URL(url).searchParams
  return Object.entries(reportFieldLabels)
    .flatMap(([id, label]) => {
      const text = query.get(id)
      return text ? [`### ${label}\n\n${text}`] : []
    })
    .join('\n\n')
}

const mm = (m: number) => (m * 1e3).toFixed(1)

/** The sheet's settings per group: distance, face, event, discipline and federation where mapped, shot count. */
export function sheetSettings(sheet: Pick<TargetSheet, 'groups'>, data?: FederationData) {
  const lines = sheet.groups.map((g) => {
    const f = g.face
    const m = f?.event && data?.mappings.find((x) => x.face === f.id && x.event === f.event)
    const d = m && data?.disciplines.find((x) => x.id === m.discipline)
    const fed = d && data?.federations.find((x) => x.id === d.federation)
    return [
      `- ${g.name}: ${Number(g.distance.toFixed(2))} m`,
      f ? `face \`${f.id}\`` : 'no face',
      ...(f?.event ? [`event "${f.event}"`] : []),
      ...(d ? [`discipline ${[d.number, d.name].filter(Boolean).join(' ')} (\`${d.id}\`)`] : []),
      ...(fed ? [`federation ${fed.abbreviation}`] : []),
      `${g.shots.length} shots`,
    ].join(', ')
  })
  return [`Groups: ${sheet.groups.length}`, '', ...lines].join('\n')
}

/** The shots of each group in target mm (x right, y up), as a fenced table. */
export function shotPositions(sheet: Pick<TargetSheet, 'groups'>) {
  const rows = sheet.groups.flatMap((g) =>
    g.shots.map(
      (s, i) => `${g.name}\t${i + 1}\t${mm(s.x)}\t${mm(s.y)}${s.excluded ? '\texcluded' : ''}`,
    ),
  )
  return ['```', 'group\tshot\tx mm\ty mm', ...rows, '```'].join('\n')
}
