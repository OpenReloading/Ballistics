import { ActionIcon, Anchor, Button, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calculator, Library, Printer, Settings, Target } from 'lucide-react'
import { expect, waitFor } from 'storybook/test'
import { AppFrame, NavItem, PageBar } from '../src/index.ts'

const meta = { title: 'Frame', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/** The frame with a page: the rail from 75em, the menu button's panel below it, the page bar on top of the page. */
export const Frame: Story = {
  render: () => (
    <AppFrame
      brand={
        <Anchor href="#" fw={650}>
          Ballistics
        </Anchor>
      }
      labels={{ menu: 'Menu', navigation: 'Main' }}
      navigation={
        <Stack gap={0}>
          <NavItem href="#" icon={Calculator} label="Loads" aria-current="page" />
          <NavItem href="#" icon={Target} label="Groups" />
          <NavItem href="#" icon={Library} label="Library" />
        </Stack>
      }
      end={
        <ActionIcon variant="subtle" color="gray" aria-label="Settings">
          <Settings aria-hidden size={18} />
        </ActionIcon>
      }
    >
      <PageBar
        title="Loads"
        status="3 loads"
        actions={
          <>
            <Button size="sm">New load</Button>
            <ActionIcon size="input-sm" variant="default" aria-label="Print">
              <Printer aria-hidden size={18} />
            </ActionIcon>
          </>
        }
      />
      <Text>The page's content.</Text>
    </AppFrame>
  ),
  play: async ({ canvas, userEvent }) => {
    const navigation = canvas.getByRole('navigation', { name: 'Main', hidden: true })
    // Mantine slides a closed navigation off the screen, which visibility checks do not see
    const onScreen = () => navigation.getBoundingClientRect().right > 0
    if (matchMedia('(min-width: 75em)').matches) {
      await expect(onScreen()).toBe(true)
      return
    }
    await expect(onScreen()).toBe(false)
    await userEvent.click(canvas.getByRole('button', { name: 'Menu' }))
    await waitFor(() => expect(onScreen()).toBe(true))
  },
}
