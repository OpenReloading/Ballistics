import { Button, Checkbox, Group, Radio, Stack, TextInput } from '@mantine/core'
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

/** A checked box and radio: their marks take the accent's text color of the scheme. */
export const Choices: Story = {
  render: () => (
    <Stack>
      <Checkbox defaultChecked label="Seated" />
      <Radio defaultChecked label="Crimped" />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const marks = canvasElement.querySelectorAll('.mantine-Checkbox-icon, .mantine-Radio-icon')
    await expect(marks).toHaveLength(2)
    if (matchMedia('(forced-colors: active)').matches) return
    const dark = matchMedia('(prefers-color-scheme: dark)').matches
    for (const mark of marks) {
      await expect(getComputedStyle(mark).color).toBe(
        dark ? 'rgb(16, 18, 27)' : 'rgb(255, 255, 255)',
      )
    }
  },
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
