import { Group, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FlaskConical } from 'lucide-react'
import { BulletIcon, CartridgeIcon, PowderIcon, RifleIcon } from '../src/index.ts'

const meta = { title: 'Icons' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const own = { Cartridge: CartridgeIcon, Bullet: BulletIcon, Rifle: RifleIcon, Powder: PowderIcon }

/** The own icons beside a Lucide one, at the navigation's size and stroke and at Lucide's default. */
export const Icons: Story = {
  render: () => (
    <Stack>
      {[
        { size: 20, strokeWidth: 1.75 },
        { size: 24, strokeWidth: 2 },
      ].map((props) => (
        <Group key={props.size}>
          {Object.entries(own).map(([label, Icon]) => (
            <Stack key={label} gap={4} align="center">
              <Icon aria-hidden {...props} />
              <Text size="xs">{label}</Text>
            </Stack>
          ))}
          <Stack gap={4} align="center">
            <FlaskConical aria-hidden {...props} />
            <Text size="xs">Lucide</Text>
          </Stack>
        </Group>
      ))}
    </Stack>
  ),
}
