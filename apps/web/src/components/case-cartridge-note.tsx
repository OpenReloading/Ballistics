'use client'

import Link from 'next/link'
import { useTranslation } from '../i18n/language.ts'

/** The cartridge a case record is made for, under its properties. */
export function CaseCartridgeNote({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation()
  return (
    <p className="record-note">
      {t('Cartridge')}: <Link href={`/cartridges/${id}`}>{name}</Link>
    </p>
  )
}
