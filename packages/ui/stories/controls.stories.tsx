import { Button, Group, Stack, TextInput } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

const meta = { title: 'Controls' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** The dense field of property grids: 24 px under a fine pointer, 44 px with 16 px text under a coarse one (spike S8). */
export const DenseField: Story = {
  render: () => <TextInput size="field" label="Charge" />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Charge')
    const coarse = matchMedia('(pointer: coarse)').matches
    // the touch browsers of vitest.config.ts, WebKit among them, must report a coarse pointer
    await expect(coarse).toBe('ontouchstart' in window)
    await expect(getComputedStyle(input).height).toBe(coarse ? '44px' : '24px')
    await expect(getComputedStyle(input).fontSize).toBe(coarse ? '16px' : '13px')
    await userEvent.tab()
    await expect(input).toHaveFocus()
    await expect(getComputedStyle(input).outlineStyle).toBe('solid')
    await expect(getComputedStyle(input).outlineWidth).toBe('2px')
  },
}

/** Text inputs at the row (xs) and bar (sm) sizes, and one with an error. */
export const Fields: Story = {
  render: () => (
    <Stack>
      <TextInput size="xs" label="Row field" />
      <TextInput size="sm" label="Bar field" />
      <TextInput size="sm" label="Field with an error" error="Enter a number" />
    </Stack>
  ),
}

/** Buttons at the row and bar sizes, filled, light and default. */
export const Buttons: Story = {
  render: () => (
    <Group>
      <Button size="xs">Row</Button>
      <Button size="sm">Bar</Button>
      <Button size="sm" variant="light">
        Light
      </Button>
      <Button size="sm" variant="default">
        Default
      </Button>
    </Group>
  ),
}
