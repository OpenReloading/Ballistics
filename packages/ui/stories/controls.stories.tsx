import { Button, Checkbox, Group, Radio, Stack, TextInput } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

const meta = { title: 'Controls' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const luminance = (color: string) => {
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map((v) => {
    const c = Number(v) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG 2 contrast of two computed `rgb()` colors. */
function contrast(a: string, b: string): number {
  const [high = 0, low = 0] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** The dense field of property grids: 24 px under a fine pointer, 44 px with 16 px text under a coarse one (spike S8). */
export const DenseField: Story = {
  render: () => <TextInput size="field" label="Charge" />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText('Charge')
    const coarse = matchMedia('(pointer: coarse)').matches
    // the touch browsers of vitest.config.ts, WebKit among them, must report a coarse pointer
    await expect(coarse).toBe('ontouchstart' in window)
    await expect(getComputedStyle(input).height).toBe(coarse ? '44px' : '24px')
    // iOS zooms into a field whose text is under 16 px
    if (coarse) await expect(getComputedStyle(input).fontSize).toBe('16px')
    await userEvent.tab()
    await expect(input).toHaveFocus()
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none')
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

/** Boxes and radios, checked and not: each part a control needs is visible at 3:1 (WCAG 1.4.11), which axe does not check. */
export const Choices: Story = {
  render: () => (
    <Stack>
      <Checkbox defaultChecked label="Seated" />
      <Checkbox label="Crimped" />
      <Radio defaultChecked name="sizing" label="Neck sized" />
      <Radio name="sizing" label="Full length" />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const boxes = canvasElement.querySelectorAll<HTMLInputElement>(
      '.mantine-Checkbox-input, .mantine-Radio-radio',
    )
    await expect(boxes).toHaveLength(4)
    if (matchMedia('(forced-colors: active)').matches) return
    const page = getComputedStyle(canvasElement.ownerDocument.body).backgroundColor
    for (const box of boxes) {
      const { backgroundColor, borderTopColor } = getComputedStyle(box)
      if (!box.checked) {
        await expect(contrast(borderTopColor, page)).toBeGreaterThanOrEqual(3)
        continue
      }
      const mark = box.parentElement?.querySelector('.mantine-Checkbox-icon, .mantine-Radio-icon')
      if (!mark) throw new Error(`a checked ${box.className} shows no mark`)
      await expect(contrast(getComputedStyle(mark).color, backgroundColor)).toBeGreaterThanOrEqual(
        3,
      )
      await expect(contrast(backgroundColor, page)).toBeGreaterThanOrEqual(3)
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
