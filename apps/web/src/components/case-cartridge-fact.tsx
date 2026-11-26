'use client'

import { useLingui } from '@lingui/react'
import { Crosshair } from 'lucide-react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/case-cartridge-fact.json' with {
  type: 'json',
}
import { Fact, FactCard } from './fact-cards.tsx'

loadEnglish(englishMessages)

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
