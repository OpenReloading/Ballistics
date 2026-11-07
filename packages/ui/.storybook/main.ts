import type { StorybookConfig } from '@storybook/react-vite'

export default {
  framework: '@storybook/react-vite',
  stories: ['../stories/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  core: { disableTelemetry: true },
} satisfies StorybookConfig
