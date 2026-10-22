'use client'

import { ListError } from '../../components/states.tsx'
import { listTitles } from '../../lib/list-titles.ts'

export default function CartridgeError({ retry }: { retry: () => void }) {
  return <ListError title={listTitles.cartridges} what="Cartridge" retry={retry} />
}
