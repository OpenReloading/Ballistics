'use client'

import { useLingui } from '@lingui/react'
import { Crosshair } from 'lucide-react'
import Link from '@/platform/link.tsx'
import { Fact, FactCard } from './fact-cards.tsx'

/** The cartridge a case record is made for, a fact card in the strip that links its record. */
export function CaseCartridgeFact({ id, name }: { id: string; name: string }) {
  const { i18n } = useLingui()
  return (
    <FactCard icon={Crosshair}>
      <Fact label={i18n._({ id: 'caseRecord.cartridge', message: 'Cartridge' })}>
        <Link href={`/cartridges/${id}`}>{name}</Link>
      </Fact>
    </FactCard>
  )
}
