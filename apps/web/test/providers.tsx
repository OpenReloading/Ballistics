import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { linguiOf } from '../src/i18n/lingui.ts'

/** The providers a view renders in: Mantine and the English Lingui messages. */
export const Providers = ({ children }: { children: ReactNode }) => (
  <MantineProvider>
    <I18nProvider i18n={linguiOf('en')}>{children}</I18nProvider>
  </MantineProvider>
)
