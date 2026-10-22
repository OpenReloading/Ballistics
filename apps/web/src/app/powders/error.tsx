'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function PowderError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.powders} what="Powder" retry={retry} />
}
