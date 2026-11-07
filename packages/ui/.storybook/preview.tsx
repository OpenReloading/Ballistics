import type { Preview } from '@storybook/react-vite'
import { UiProvider } from '../src/index.ts'
import '../css/ui.css'

export default {
  // the scheme follows the system setting, which each test browser of vitest.config.ts emulates
  decorators: [
    (Story) => (
      <UiProvider defaultColorScheme="auto">
        <Story />
      </UiProvider>
    ),
  ],
  parameters: {
    // axe with the WCAG 2.2 AA rules on every story: a finding fails the story's test
    a11y: {
      test: 'error',
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      },
    },
  },
} satisfies Preview
