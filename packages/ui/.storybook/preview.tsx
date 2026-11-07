import type { Preview } from '@storybook/react-vite'
import { UiProvider } from '../src/index.ts'
import '../css/ui.css'

// the width of a story test's project (vitest.config.ts); undefined in Storybook itself
declare const __STORY_WIDTH__: number | undefined
const testWidth = typeof __STORY_WIDTH__ === 'number' ? __STORY_WIDTH__ : undefined

export default {
  ...(testWidth && {
    initialGlobals: { viewport: { value: 'test' } },
  }),
  // the scheme follows the system setting, which each test browser of vitest.config.ts emulates
  decorators: [
    (Story) => (
      <UiProvider defaultColorScheme="auto">
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
