import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  NavLink,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core'
import { Bug } from 'lucide-react'
import { useEffect, useState } from 'react'
import web from '../../package.json'
import { loadEnglish } from '../i18n/lingui.ts'
import {
  type ReportArea,
  type ReportBlock,
  type ReportContext,
  type ReportType,
  reportArea,
  reportAreas,
  reportRecord,
  reportSent,
  reportTypes,
  reportUrl,
} from '../lib/report-issue.ts'
import { databaseTabs, type PageEntry, sections } from '../lib/sections.ts'
import { presetNames } from '../lib/units.ts'
import englishMessages from '../locales/en/components/report-issue.json' with { type: 'json' }
import sectionsEnglish from '../locales/en/lib/sections.json' with { type: 'json' }
import { AppModal } from './app-modal.tsx'
import { type ReportOption, reportHost } from './report-host.ts'
import { useUnits } from './units-settings.tsx'
import { useRoute } from './use-route.ts'

loadEnglish(englishMessages, sectionsEnglish)

const label = /*i18n*/ { id: 'reportIssue.title', message: 'Report an issue' }

/** The title of a page of the sidebar or the Database tabs. */
function pageLabel(href: string): MessageDescriptor {
  const pages: readonly { href: string; label: MessageDescriptor }[] = [
    ...databaseTabs,
    ...sections.flatMap((s): readonly PageEntry[] => s.pages),
  ]
  const page = pages.find((p) => p.href === href)
  if (!page) throw new Error(`No page ${href} in sections.ts`)
  return page.label
}

/** The areas and types as the dialog shows them, an area of a page by its title; the report itself carries the English value. */
const areaLabels: Record<ReportArea, MessageDescriptor> = {
  Workbench: /*i18n*/ { id: 'reportIssue.area.workbench', message: 'Workbench' },
  'Shot groups': pageLabel('/groups'),
  'Session summary': pageLabel('/session'),
  Cartridges: pageLabel('/cartridges'),
  Bullets: pageLabel('/bullets'),
  Powders: pageLabel('/powders'),
  Brass: pageLabel('/cases'),
  Primers: pageLabel('/primers'),
  Targets: pageLabel('/targets'),
  Disciplines: pageLabel('/disciplines'),
  Federations: pageLabel('/federations'),
  Firearms: pageLabel('/firearms'),
  'Cartridge designer': /*i18n*/ { id: 'page.cartridgesDesigner', message: 'Cartridge designer' },
  'Bullet designer': /*i18n*/ { id: 'page.bulletsDesigner', message: 'Bullet designer' },
  Settings: /*i18n*/ { id: 'shell.settings', message: 'Settings' },
  Other: /*i18n*/ { id: 'reportIssue.area.other', message: 'Other' },
}
const typeLabels: Record<ReportType, MessageDescriptor> = {
  Bug: /*i18n*/ { id: 'reportIssue.type.bug', message: 'Bug' },
  'Wrong data': /*i18n*/ { id: 'reportIssue.type.wrongData', message: 'Wrong data' },
  Idea: /*i18n*/ { id: 'reportIssue.type.idea', message: 'Idea' },
}

/** The dialog's label of the report text. */
const reportQuestion = (type: ReportType) =>
  type === 'Idea'
    ? /*i18n*/ { id: 'reportIssue.need', message: 'What do you need?' }
    : /*i18n*/ { id: 'reportIssue.happened', message: 'What happened?' }

/** An icon left of the repository link from 75em, a labeled row in the phone drawer; nothing without a repository URL. */
export function ReportIssueButton({
  url,
  drawer,
  onOpen,
}: {
  url?: string | undefined
  drawer?: boolean
  onOpen: () => void
}) {
  const { i18n } = useLingui()
  if (!url) return null
  const icon = <Bug size={20} aria-hidden="true" />
  if (drawer)
    return (
      <NavLink
        component="button"
        label={i18n._(label)}
        leftSection={icon}
        aria-haspopup="dialog"
        onClick={onOpen}
      />
    )
  return (
    <Tooltip label={i18n._(label)}>
      <ActionIcon
        variant="default"
        visibleFrom="lg"
        aria-label={i18n._(label)}
        className="report-issue"
        onClick={onOpen}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  )
}

/** The page and browser facts every report carries, read when the dialog opens. */
function useContextNow(opened: boolean, route: string): ReportContext | undefined {
  const scheme = useComputedColorScheme('light')
  const { choice } = useUnits()
  const [context, setContext] = useState<ReportContext>()
  useEffect(() => {
    if (!opened) return
    const record = reportRecord(route)
    const name = document.querySelector('main h1')?.textContent?.trim()
    const overrides = Object.entries(choice.overrides).map(([q, u]) => `${q} ${u}`)
    setContext({
      path: route,
      title: document.title,
      ...(record && { record: { ...record, ...(name && { name }) } }),
      version: web.version,
      userAgent: navigator.userAgent,
      window: `${window.innerWidth} x ${window.innerHeight}`,
      colourScheme: scheme,
      units: `${presetNames[choice.preset].message}${overrides.length ? `, ${overrides.join(', ')}` : ''}`,
    })
  }, [opened, route, scheme, choice])
  return context
}

/** The page's data boxes start unticked; Open on GitHub opens the repository's new-issue form with the text shown, in a new tab. */
export function ReportIssueDialog({
  repository,
  opened,
  onClose,
}: {
  repository: string
  opened: boolean
  onClose: () => void
}) {
  const route = useRoute()
  const { i18n } = useLingui()
  const context = useContextNow(opened, route)
  const [area, setArea] = useState<ReportArea>('Other')
  const [type, setType] = useState<ReportType>('Bug')
  const [what, setWhat] = useState('')
  const [options, setOptions] = useState<ReportOption[]>([])
  const [ticked, setTicked] = useState<string[]>([])
  const [blocks, setBlocks] = useState<ReportBlock[]>([])
  // each opening starts from the page shown
  useEffect(() => {
    if (!opened) return
    setArea(reportArea(route))
    setOptions(reportHost.options?.() ?? [])
    setTicked([])
  }, [opened, route])
  const active = options.filter(
    (o) => ticked.includes(o.label) && (!o.needs || ticked.includes(o.needs)),
  )
  const activeKey = active.map((o) => o.label).join('\n')
  useEffect(() => {
    let current = true
    void Promise.all(
      active.map(async (o) => {
        const text = await Promise.resolve(o.text()).catch(() => undefined)
        return text === undefined ? [] : [{ heading: o.heading, text }]
      }),
    ).then((b) => current && setBlocks(b.flat()))
    return () => {
      current = false
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the ticked boxes are `activeKey`
  }, [activeKey, options])
  const url = context && reportUrl(repository, { area, type, what, context, blocks })
  const sent = url ? reportSent(url) : ''
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={i18n._(label)}
      size="lg"
      footer={
        <Group justify="flex-end" gap="xs" p="md" pt={0}>
          <Button variant="default" onClick={onClose}>
            {i18n._({ id: 'reportIssue.cancel', message: 'Cancel' })}
          </Button>
          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            disabled={!url}
          >
            {i18n._({ id: 'reportIssue.open', message: 'Open on GitHub' })}
          </Button>
        </Group>
      }
    >
      <Stack gap="xs">
        <Group gap="xs" align="flex-end" wrap="wrap">
          <Select
            label={i18n._({ id: 'reportIssue.areaLabel', message: 'Area' })}
            allowDeselect={false}
            data={reportAreas.map((a) => ({ value: a, label: i18n._(areaLabels[a]) }))}
            value={area}
            onChange={(v) => v && setArea(v as ReportArea)}
            comboboxProps={{ withinPortal: false }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500} id="report-type">
              {i18n._({ id: 'reportIssue.typeLabel', message: 'Type' })}
            </Text>
            <SegmentedControl
              aria-labelledby="report-type"
              data={reportTypes.map((r) => ({ value: r, label: i18n._(typeLabels[r]) }))}
              value={type}
              onChange={(v) => setType(v as ReportType)}
            />
          </Stack>
        </Group>
        <Textarea
          label={i18n._(reportQuestion(type))}
          autosize
          minRows={3}
          maxRows={8}
          value={what}
          onChange={(e) => setWhat(e.currentTarget.value)}
          data-autofocus
        />
        {options.map((o) => (
          <Checkbox
            key={o.label}
            label={o.label}
            checked={ticked.includes(o.label)}
            disabled={o.needs !== undefined && !ticked.includes(o.needs)}
            onChange={(e) => {
              const on = e.currentTarget.checked
              setTicked((t) => (on ? [...t, o.label] : t.filter((x) => x !== o.label)))
            }}
          />
        ))}
        <Textarea
          label={i18n._({ id: 'reportIssue.sent', message: 'Sent with the report' })}
          description={i18n._({
            id: 'reportIssue.public',
            message: 'Public on GitHub. No photos, files or other records of this browser.',
          })}
          readOnly
          autosize
          minRows={4}
          maxRows={10}
          value={sent}
          className="report-preview"
        />
      </Stack>
    </AppModal>
  )
}
