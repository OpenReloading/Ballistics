'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function TargetsError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.targets} what="Target face" retry={retry} />
}
