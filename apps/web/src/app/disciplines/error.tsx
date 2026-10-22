'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function DisciplinesError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.disciplines} what="Discipline" retry={retry} />
}
