import { ActionIcon, Anchor, Button, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calculator, Library, Printer, Settings, Target } from 'lucide-react'
import { expect, waitFor, within } from 'storybook/test'
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
      labels={{ menu: 'Menu', navigation: 'Main', close: 'Close navigation' }}
      navigation={
        // the story's links lead nowhere: a followed link would leave the test page
        <Stack gap={0} onClick={(event) => event.preventDefault()}>
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    if (matchMedia('(min-width: 75em)').matches) {
      await expect(canvas.getByRole('navigation', { name: 'Main' })).toBeVisible()
      return
    }
    // below 75em the links are in the drawer only, which Mantine renders into the document's body
    const page = within(canvasElement.ownerDocument.body)
    await expect(canvas.queryByRole('navigation', { name: 'Main' })).toBeNull()
    const menu = canvas.getByRole('button', { name: 'Menu' })
    if (matchMedia('(pointer: coarse)').matches)
      await expect(menu.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await userEvent.click(menu)
    const drawer = await page.findByRole('dialog', { name: 'Main' })
    // past its last link the focus stays inside: the close button and three links, five steps
    for (let step = 0; step < 5; step++) await userEvent.tab()
    await expect(drawer).toContainElement(canvasElement.ownerDocument.activeElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(menu).toHaveFocus())
    await userEvent.click(menu)
    await userEvent.click(await page.findByRole('link', { name: 'Groups' }))
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull())
  },
}
