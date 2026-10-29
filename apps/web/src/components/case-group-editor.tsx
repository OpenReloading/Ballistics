'use client'

import { Button } from '@mantine/core'
import type { Case, UserCaseRecord, UserRecord } from '@open-reloading/schema'
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Message } from '../i18n/translate.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { CartridgeDetail } from '../lib/api-types.ts'
import { blankCaseGroup, caseGroupProblem, groupCapacity, withCapacity } from '../lib/case-group.ts'
import { catalogueCartridgeId } from '../lib/firearm.ts'
import { listTitles } from '../lib/list-titles.ts'
import { capacityRecord } from '../lib/load-record.ts'
import { waterVolume } from '../lib/units.ts'
import { putRecords, storedRecords } from '../lib/user-store.ts'
import { CaseEditor } from './case-editor.tsx'
import { FileMenu, type FileMenuHandle } from './file-menu.tsx'
import { PageBar } from './page-bar.tsx'
import { ErrorNote } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'
import { recordLoadingText, useRecordLink } from './use-record-link.ts'

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

/**
 * The editor of one group of cases, the page a Mine row of the Cases list opens: a new group, or the
 * stored one that `?record=` names. The File menu saves and opens the browser's groups.
 */
export function CaseGroupEditor() {
  const { t } = useTranslation()
  const { system } = useUnits()
  const [data, setData] = useState<Case>(blankCaseGroup)
  /** The measured water capacity, m3: a record of its own that the group names. */
  const [capacity, setCapacity] = useState<number>()
  const [failure, setFailure] = useState<Message>()
  const [nameLeft, setNameLeft] = useState(false)
  /** A new or opened group remounts the editor, so no field starts as left. */
  const [generation, setGeneration] = useState(0)
  const menu = useRef<FileMenuHandle>(null)
  useRecordLink('case', menu, (m) => setFailure(m === recordLoadingText ? undefined : m))
  const { nameOf: cartridgeName, setNames: setCartridgeNames } = useCartridgeNames([data.cartridge])

  /** Shows `next` in a remounted editor, with its measured capacity `m3`. */
  const show = (next: Case, m3?: number) => {
    setData(next)
    setCapacity(m3)
    setNameLeft(false)
    setGeneration((g) => g + 1)
  }
  // the capacity record is read at the open: a link opens before any earlier read of the store is back
  const onOpen = async (d: Case) => {
    const { records } = await storedRecords().catch(() => ({ records: [] }))
    show(d, capacityIn(d, records))
  }

  // the File menu renders after an edit, from the deferred data
  const fileData = useDeferredValue(withCapacity(data, capacity))
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
                if (await menu.current?.startNew(blank)) show(blank)
              }}
            >
              {t('New brass group')}
            </Button>
            <FileMenu
              ref={menu}
              kind="case"
              name={fileData.name ?? ''}
              data={fileData}
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
        {failure && <ErrorNote>{t(failure)}</ErrorNote>}
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
