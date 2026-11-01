'use client'

import { Crosshair } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslation } from '../i18n/language.ts'
import { Fact, FactCard } from './fact-cards.tsx'

/** The cartridge a case record is made for, a fact card in the strip that links its record. */
export function CaseCartridgeFact({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation()
  return (
    <FactCard icon={Crosshair}>
      <Fact label={t('Cartridge')}>
        <Link href={`/cartridges/${id}`}>{name}</Link>
      </Fact>
    </FactCard>
  )
}
