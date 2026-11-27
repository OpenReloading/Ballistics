import { useLingui } from '@lingui/react'
import { Button, Tooltip } from '@mantine/core'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { fitRule } from '../lib/bullet-fit.ts'
import { controlSize } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/cartridge-bullets.json' with { type: 'json' }
import { NavIcon } from './nav-icons.tsx'

loadEnglish(englishMessages)

/** The link to the bullet list of the bullets that fit a cartridge (`bulletFits`, counted by the page), the rule on hover. */
export function CartridgeBullets({ id, count }: { id: string; count: number }) {
  const { i18n } = useLingui()
  return (
    <Tooltip label={i18n._(fitRule)} multiline maw={320}>
      <Button
        component={Link}
        href={`/bullets?fits=${encodeURIComponent(id)}`}
        variant="default"
        size={controlSize.row.button}
        leftSection={<NavIcon name="/bullets" size={16} />}
        className="cartridge-bullets"
      >
        {i18n._({ id: 'cartridgeRecord.bullets', message: 'Bullets ({count})', values: { count } })}
      </Button>
    </Tooltip>
  )
}
