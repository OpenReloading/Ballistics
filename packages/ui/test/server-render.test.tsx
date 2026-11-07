import { composeStories } from '@storybook/react-vite'
import type { FC } from 'react'
import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import preview from '../.storybook/preview.tsx'

// every story module, so a new component is server-rendered as soon as it has a story (spike S1)
const modules = import.meta.glob<Parameters<typeof composeStories>[0]>('../stories/*.stories.tsx', {
  eager: true,
})
const stories = Object.entries(modules).flatMap(([file, module]) =>
  // the module type is generic, which loses the story type
  Object.entries(composeStories(module, preview) as Record<string, FC>).map(
    ([name, Story]) => [`${file} ${name}`, Story] as const,
  ),
)

it('runs without a browser global', () => {
  expect(typeof window).toBe('undefined')
  expect(stories.length).toBeGreaterThan(0)
})

it.each(stories)('renders %s on the server', (_, Story) => {
  expect(renderToString(<Story />)).toMatch(/^<.*>$/s)
})
