'use client'

import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { Button } from '@mantine/core'
import type { Case, UserCaseRecord, UserRecord } from '@rangefoundry/schema'
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { putRecords, storedRecords } from '@/platform/user-store.ts'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish } from '../i18n/lingui.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import { blankCaseGroup, caseGroupProblem, groupCapacity, withCapacity } from '../lib/case-group.ts'
import { catalogueCartridgeId } from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { capacityRecord } from '../lib/load-record.ts'
import { newId } from '../lib/new-id.ts'
import { waterVolume } from '../lib/units.ts'
import { namedKey } from '../lib/user-data.ts'
import englishMessages from '../locales/en/components/case-group-editor.json' with { type: 'json' }
import { CaseEditor } from './case-editor.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { ErrorNote } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { useKeptDraft } from './use-kept-draft.ts'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

loadEnglish(englishMessages)

/** Cartridge names by record id, each asked of the API once; the stored reference shows until it answers. */
function useCartridgeNames(refs: readonly (string | undefined)[]) {
  const [names, setNames] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const ids = refs
    .map((c) => catalogueCartridgeId(c))
    .filter((c): c is string => !!c)
    .join('\n')
  useEffect(() => {
    for (const id of new Set(ids.split('\n'))) {
      if (!id || asked.current.has(id)) continue
      asked.current.add(id)
      fetchRecord<CartridgeDetail>('cartridges', id)
        .then((c) => c && setNames((n) => ({ ...n, [c.id]: c.name })))
        // unreachable or unknown: the stored id shows
        .catch(() => {})
    }
  }, [ids])
  const nameOf = (ref: string | undefined) => {
    const id = catalogueCartridgeId(ref)
    return id === undefined ? ref || undefined : (names[id] ?? id)
  }
  return { nameOf, setNames }
}

/** The measured capacity of a group as the form holds it, m3. */
const capacityIn = (c: Case, records: readonly UserRecord[] | undefined) => {
  const grams = groupCapacity(c, records ?? [])
  return grams === undefined ? undefined : waterVolume(grams)
}

const fallbackName = 'Brass group'
const blankData = blankCaseGroup()
const blankKey = namedKey(blankData, '')
const notKept = /*i18n*/ { id: 'caseGroupEditor.notSaved', message: 'Not saved in this browser' }

/** A group kept in the browser, with its measured capacity `m3`. */
interface Draft {
  data: Case
  key: string
  m3: number | undefined
}

/** A new group, or the stored one that `?record=` names; every valid change is kept in the browser, and the File menu opens the browser's groups. */
export function CaseGroupEditor() {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const { system } = useUnits()
  const [data, setData] = useState<Case>(blankCaseGroup)
  /** The measured water capacity, m3: a record of its own that the group names. */
  const [capacity, setCapacity] = useState<number>()
  const [failure, setFailure] = useState<MessageDescriptor>()
  const [nameLeft, setNameLeft] = useState(false)
  /** A new or opened group remounts the editor, so no field starts as left. */
  const [generation, setGeneration] = useState(0)
  const menu = useRef<FileMenuHandle>(null)
  useRecordLink('case', menu, (m) => setFailure(m === recordLoadingText ? undefined : m))
  const { nameOf: cartridgeName, setNames: setCartridgeNames } = useCartridgeNames([data.cartridge])

  const group = withCapacity(data, capacity)
  const groupKey = namedKey(group, '')
  // the record format refuses a group without a name or cartridge: the last valid one stays kept
  const [draft, setDraft] = useState<Draft>({ data: blankData, key: blankKey, m3: undefined })
  if (groupKey !== draft.key && !caseGroupProblem(group.name ?? '', group, t))
    setDraft({ data: group, key: groupKey, m3: capacity })
  const [recordId, setRecordId] = useState(newId)
  const { kept, flush, drop, stored } = useKeptDraft(
    'case',
    fallbackName,
    blankKey,
    recordId,
    draft.data.name ?? '',
    draft.data,
    draft.key,
  )
  /** The capacity reference whose record the browser holds: an opened group's is stored already. */
  const capacityKept = useRef<string>(undefined)
  // the group names its capacity, a record of its own: written ahead of the group's delayed write, so no flush of the group goes without it
  useEffect(() => {
    const { data, m3 } = draft
    if (m3 === undefined || !data.capacity || data.capacity === capacityKept.current) return
    capacityKept.current = data.capacity
    putRecords([capacityRecord(data.cartridge, m3, new Date())]).then(
      () => setFailure((f) => (f === notKept ? undefined : f)),
      () => {
        capacityKept.current = undefined
        setFailure(notKept)
      },
    )
  }, [draft])

  /** Shows `next` as the record `id` in a remounted editor, with its measured capacity `m3`; `written` when the browser holds it. */
  const show = (id: string, next: Case, m3: number | undefined, written: boolean) => {
    const shown = withCapacity(next, m3)
    const key = namedKey(shown, '')
    setDraft({ data: shown, key, m3 })
    stored.current = { key, written }
    capacityKept.current = shown.capacity
    setRecordId(id)
    setData(next)
    setCapacity(m3)
    setNameLeft(false)
    setGeneration((g) => g + 1)
    setFailure((f) => (f === notKept ? undefined : f))
  }
  // the capacity record is read at the open: a link opens before any earlier read of the store is back
  const onOpen = async (d: Case, _name: string, record: { id: string }) => {
    const { records } = await storedRecords().catch(() => ({ records: [] }))
    // an older draft of the same id must not overwrite the opened record
    if (record.id === recordId) drop()
    else flush()
    show(record.id, d, capacityIn(d, records), true)
  }

  // the File menu renders after an edit, from the deferred data
  const fileData = useDeferredValue(group)
  const problem = caseGroupProblem(fileData.name ?? '', fileData, t)
  const patch = (p: Partial<Case>) => setData((d) => ({ ...d, ...p }))
  /** A cleared field also drops the reference to a record this browser does not hold. */
  const changeCapacity = (m3: number | undefined) => {
    setCapacity(m3)
    if (m3 === undefined) patch({ capacity: undefined })
  }

  /** Save's browser copy: the group with the record of its measured capacity. */
  const store = useCallback(
    async (record: UserCaseRecord) => {
      await putRecords([
        ...(capacity === undefined
          ? []
          : [capacityRecord(record.data.cartridge, capacity, new Date())]),
        record,
      ])
      return true
    },
    [capacity],
  )

  return (
    <>
      <PageBar
        title={listTitles.caseGroup}
        translated
        actions={
          <>
            <Button
              variant="default"
              onClick={async () => {
                const blank = blankCaseGroup()
                if (!(await menu.current?.startNew(blank))) return
                flush()
                show(newId(), blank, undefined, false)
              }}
            >
              {i18n._({ id: 'caseGroupEditor.new', message: 'New brass group' })}
            </Button>
            <FileMenu
              ref={menu}
              kind="case"
              name={fileData.name ?? ''}
              data={fileData}
              autosaved={recordId}
              browserList
              kept={groupKey === draft.key && failure !== notKept ? kept : 'failed'}
              problem={problem}
              idle={false}
              store={store}
              onOpen={onOpen}
            />
            <UnitsIconButton />
          </>
        }
      />
      <div className="library">
        {failure && <ErrorNote>{i18n._(failure)}</ErrorNote>}
        <CaseEditor
          key={generation}
          data={data}
          capacity={capacity}
          system={system}
          nameLeft={nameLeft}
          setNameLeft={setNameLeft}
          setCartridgeNames={setCartridgeNames}
          cartridgeName={cartridgeName}
          patch={patch}
          setCapacity={changeCapacity}
        />
      </div>
    </>
  )
}
