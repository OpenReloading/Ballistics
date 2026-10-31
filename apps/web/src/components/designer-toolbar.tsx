'use client'

import { Button, Flex } from '@mantine/core'
import { ArrowCounterClockwise, ArrowUUpLeft, ArrowUUpRight, Plus } from '@phosphor-icons/react'
import { memo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { shortcutAriaKeys, shortcutLabel } from '../lib/shortcuts.ts'
import type { UnitSystem } from '../lib/units.ts'

type ToolbarAction =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'new'; system: UnitSystem }
  | { type: 'reset'; system: UnitSystem }

/**
 * Undo, redo, new and reset of a designer, re-rendered only when one of them changes state. The
 * designers name the last two ("New bullet", "Reset to record").
 */
export const DesignerToolbar = memo(function DesignerToolbar({
  undo,
  redo,
  reset,
  newLabel,
  resetLabel,
  system,
  dispatch,
}: {
  undo: boolean
  redo: boolean
  reset?: boolean
  newLabel: string
  /** Without it the toolbar has no reset. */
  resetLabel?: string
  system: UnitSystem
  dispatch: (a: ToolbarAction) => void
}) {
  const { t } = useTranslation()
  return (
    <Flex className="toolbar" wrap="wrap" gap="xs">
      <Button
        variant="default"
        className="bar-icon"
        disabled={!undo}
        leftSection={<ArrowUUpLeft aria-hidden="true" />}
        onClick={() => dispatch({ type: 'undo' })}
        title={t('Undo ({shortcut})', { shortcut: shortcutLabel('undo') })}
        aria-keyshortcuts={shortcutAriaKeys('undo')}
      >
        {t('Undo')}
      </Button>
      <Button
        variant="default"
        className="bar-icon"
        disabled={!redo}
        leftSection={<ArrowUUpRight aria-hidden="true" />}
        onClick={() => dispatch({ type: 'redo' })}
        title={t('Redo ({shortcut})', { shortcut: shortcutLabel('redo') })}
        aria-keyshortcuts={shortcutAriaKeys('redo')}
      >
        {t('Redo')}
      </Button>
      <Button
        variant="default"
        leftSection={<Plus aria-hidden="true" />}
        onClick={() => dispatch({ type: 'new', system })}
      >
        {newLabel}
      </Button>
      {resetLabel && (
        <Button
          variant="default"
          className="bar-icon"
          disabled={!reset}
          leftSection={<ArrowCounterClockwise aria-hidden="true" />}
          onClick={() => dispatch({ type: 'reset', system })}
          title={resetLabel}
        >
          {resetLabel}
        </Button>
      )}
    </Flex>
  )
})
