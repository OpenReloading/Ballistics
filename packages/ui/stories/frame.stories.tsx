import { ActionIcon, Anchor, Button, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calculator, Library, Printer, Settings, Target } from 'lucide-react'
import { useState } from 'react'
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
    if (matchMedia('(width >= 75em)').matches) {
      await expect(canvas.getByRole('navigation', { name: 'Main' })).toBeVisible()
      return
    }
    // below 75em the links are in the drawer only, which Mantine renders into the document's body
    const page = within(canvasElement.ownerDocument.body)
    await expect(canvas.queryByRole('navigation', { name: 'Main' })).toBeNull()
    const menu = canvas.getByRole('button', { name: 'Navigation' })
    await userEvent.click(menu)
    const drawer = await page.findByRole('dialog', { name: 'Main' })
    if (matchMedia('(pointer: coarse)').matches) {
      await expect(menu.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      const close = page.getByRole('button', { name: 'Close navigation' })
      await expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // past its last link the focus stays inside: the close button and three links, five steps
    for (let step = 0; step < 5; step++) await userEvent.tab()
    await expect(drawer.contains(canvasElement.ownerDocument.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(menu).toHaveFocus())
    // the drawer leaves after its transition; reopened before that, the old one would still be found
    const closed = () =>
      waitFor(() => expect(page.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    await closed()
    await userEvent.click(menu)
    await userEvent.click(await page.findByRole('link', { name: 'Groups' }))
    await closed()
  },
}

function DialogOpener() {
  const [closed, setClosed] = useState(0)
  return (
    <AppFrame
      brand={
        <Anchor href="#" fw={650}>
          Ballistics
        </Anchor>
      }
      navigation={<Button aria-haspopup="dialog">Report an issue</Button>}
      onDrawerClosed={() => setClosed((count) => count + 1)}
    >
      <Text>{`Drawer closed ${closed} times`}</Text>
    </AppFrame>
  )
}

/** A control that opens a dialog closes the drawer first, runs `onDrawerClosed` once after it left, and the menu button gets the focus. */
export const DrawerDialogControl: Story = {
  render: () => <DialogOpener />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    if (matchMedia('(width >= 75em)').matches) return
    const page = within(canvasElement.ownerDocument.body)
    const menu = canvas.getByRole('button', { name: 'Navigation' })
    await userEvent.click(menu)
    await userEvent.click(await page.findByRole('button', { name: 'Report an issue' }))
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull(), { timeout: 3000 })
    await expect(await canvas.findByText('Drawer closed 1 times')).toBeVisible()
    await expect(menu).toHaveFocus()
  },
}
