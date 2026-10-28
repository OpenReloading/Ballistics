'use client'

import { Button, Tooltip } from '@mantine/core'
import Link from 'next/link'
import { useTranslation } from '../i18n/language.ts'
import { fitRule } from '../lib/bullet-fit.ts'
import { controlSize } from '../lib/theme.ts'
import { NavIcon } from './nav-icons.tsx'

/** The link to the bullet list of the bullets that fit a cartridge (`bulletFits`, counted by the page), the rule on hover. */
export function CartridgeBullets({ id, count }: { id: string; count: number }) {
  const { t } = useTranslation()
  return (
    <Tooltip label={t(fitRule)} multiline maw={320}>
      <Button
        component={Link}
        href={`/bullets?fits=${encodeURIComponent(id)}`}
        variant="default"
        size={controlSize.row.button}
        leftSection={<NavIcon name="/bullets" size={16} />}
        className="cartridge-bullets"
      >
        {t('Bullets ({count})', { count })}
      </Button>
    </Tooltip>
  )
}
