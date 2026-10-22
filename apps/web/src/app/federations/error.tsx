'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function FederationsError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.federations} what="Federation" retry={retry} />
}
