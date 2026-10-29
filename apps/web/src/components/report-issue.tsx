'use client'

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
import { Bug } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import web from '../../package.json'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg } from '../i18n/translate.ts'
import {
  type ReportArea,
  type ReportBlock,
  type ReportContext,
  type ReportType,
  reportArea,
  reportAreas,
  reportQuestion,
  reportRecord,
  reportSent,
  reportTypes,
  reportUrl,
} from '../lib/report-issue.ts'
import { presetNames } from '../lib/units.ts'
import { AppModal } from './app-modal.tsx'
import { type ReportOption, reportHost } from './report-host.ts'
import { useUnits } from './units-settings.tsx'
import { useRoute } from './use-route.ts'

const label = msg('Report an issue')

/** The areas and types as the dialog shows them; the report itself carries the English value. */
const areaLabels: Record<ReportArea, Message> = {
  Workbench: msg('Workbench'),
  'Shot groups': msg('Shot groups'),
  'Session summary': msg('Session summary'),
  Cartridges: msg('Cartridges'),
  Bullets: msg('Bullets'),
  Powders: msg('Powders'),
  Brass: msg('Brass'),
  Primers: msg('Primers'),
  Targets: msg('Targets'),
  Disciplines: msg('Disciplines'),
  Federations: msg('Federations'),
  Firearms: msg('Firearms'),
  'Cartridge designer': msg('Cartridge designer'),
  'Bullet designer': msg('Bullet designer'),
  Settings: msg('Settings'),
  Other: msg('Other'),
}
const typeLabels: Record<ReportType, Message> = {
  Bug: msg('Bug'),
  'Wrong data': msg('Wrong data'),
  Idea: msg('Idea'),
}

/**
 * Report an issue: an icon left of the repository link in the top bar from 75em, a labelled row in
 * the phone drawer. Renders nothing without a repository URL.
 */
export function ReportIssueButton({
  url,
  drawer,
  onOpen,
}: {
  url?: string | undefined
  drawer?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  if (!url) return null
  const icon = <Bug size={20} aria-hidden="true" />
  if (drawer)
    return <NavLink component="button" label={t(label)} leftSection={icon} onClick={onOpen} />
  return (
    <Tooltip label={t(label)}>
      <ActionIcon
        variant="default"
        visibleFrom="lg"
        aria-label={t(label)}
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
      units: `${presetNames[choice.preset]}${overrides.length ? `, ${overrides.join(', ')}` : ''}`,
    })
  }, [opened, route, scheme, choice])
  return context
}

/**
 * The report dialog: area, type, the text, the page's data boxes (unticked) and the text that
 * will be sent; Open on GitHub opens the repository's new-issue form with it in a new tab.
 */
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
  const { t } = useTranslation()
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ticked boxes are `activeKey`
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
  }, [activeKey, options])
  const url = context && reportUrl(repository, { area, type, what, context, blocks })
  const sent = url ? reportSent(url) : ''
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={t(label)}
      size="lg"
      footer={
        <Group justify="flex-end" gap="xs" p="md" pt={0}>
          <Button variant="default" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            disabled={!url}
          >
            {t('Open on GitHub')}
          </Button>
        </Group>
      }
    >
      <Stack gap="xs">
        <Group gap="xs" align="flex-end" wrap="wrap">
          <Select
            label={t('Area')}
            allowDeselect={false}
            data={reportAreas.map((a) => ({ value: a, label: t(areaLabels[a]) }))}
            value={area}
            onChange={(v) => v && setArea(v as ReportArea)}
            comboboxProps={{ withinPortal: false }}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500} id="report-type">
              {t('Type')}
            </Text>
            <SegmentedControl
              aria-labelledby="report-type"
              data={reportTypes.map((r) => ({ value: r, label: t(typeLabels[r]) }))}
              value={type}
              onChange={(v) => setType(v as ReportType)}
            />
          </Stack>
        </Group>
        <Textarea
          label={t(reportQuestion(type))}
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
          label={t('Sent with the report')}
          description={t('Public on GitHub. No photos, files or other records of this browser.')}
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
