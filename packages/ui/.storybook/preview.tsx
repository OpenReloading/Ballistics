import { setupI18n } from '@lingui/core'
import type { Preview } from '@storybook/react-vite'
import { UiProvider, uiMessages } from '../src/index.ts'
import '../css/ui.css'

// the width of a story test's project (vitest.config.ts); undefined in Storybook itself
// oxlint-disable-next-line no-underscore-dangle -- the double underscores of Vite's define names
declare const __STORY_WIDTH__: number | undefined
const testWidth = typeof __STORY_WIDTH__ === 'number' ? __STORY_WIDTH__ : undefined

// one instance per language, picked by the toolbar: activating inside the decorator would update the provider in render
const i18n = {
  en: setupI18n({ locale: 'en', messages: uiMessages }),
  de: setupI18n({ locale: 'de', messages: uiMessages }),
}

export default {
  // the story tests run in English
  initialGlobals: { locale: 'en', ...(testWidth && { viewport: { value: 'test' } }) },
  globalTypes: {
    locale: { description: 'Language', toolbar: { icon: 'globe', items: ['en', 'de'] } },
  },
  // the scheme follows the system setting, which each test browser of vitest.config.ts emulates
  decorators: [
    (Story, { globals }) => (
      <UiProvider i18n={globals['locale'] === 'de' ? i18n.de : i18n.en} defaultColorScheme="auto">
        <Story />
      </UiProvider>
    ),
  ],
  parameters: {
    ...(testWidth && {
      viewport: {
        options: { test: { name: 'Test', styles: { width: `${testWidth}px`, height: '900px' } } },
      },
    }),
    // axe with the WCAG 2.2 AA rules on every story: a finding fails the story's test
    a11y: {
      test: 'error',
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      },
    },
  },
} satisfies Preview
