'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function CaseError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.cases} what="Case" retry={retry} />
}
