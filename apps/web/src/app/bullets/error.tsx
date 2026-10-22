'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function BulletError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.bullets} what="Bullet" retry={retry} />
}
