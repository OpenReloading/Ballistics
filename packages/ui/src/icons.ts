import { createLucideIcon, type LucideIcon } from 'lucide-react'

/** A cartridge lying: rim, case, shoulder and the seated bullet's nose, on Lucide's 24 grid. */
export const CartridgeIcon: LucideIcon = createLucideIcon({
  name: 'cartridge',
  node: [
    [
      'path',
      {
        d: 'M3 8.5v7M4.5 9H12l2 1.5h1.5c2.5 0 4.5.6 5.5 1.5-1 .9-3 1.5-5.5 1.5H14L12 15H4.5zM14 10.5v3',
        key: 'case',
      },
    ],
  ],
})

/** A bullet standing, its ogive up and a cannelure, on Lucide's 24 grid. */
export const BulletIcon: LucideIcon = createLucideIcon({
  name: 'bullet',
  node: [
    [
      'path',
      { d: 'M8.5 21V11c0-3.5 1.6-6.5 3.5-8 1.9 1.5 3.5 4.5 3.5 8v10zM8.5 17h7', key: 'body' },
    ],
  ],
})

/** A rifle with its scope, on Lucide's 24 grid; Lucide's crosshair would echo the groups' target. */
export const RifleIcon: LucideIcon = createLucideIcon({
  name: 'rifle',
  node: [
    ['path', { d: 'M2 11l6-.5.5-.5H22v1.5H12L11 13H9l-1.5 2.5H3.5zM9.5 7h5v2h-5z', key: 'stock' }],
  ],
})

/** Powder poured onto a heap, on Lucide's 24 grid; Lucide draws no powder. */
export const PowderIcon: LucideIcon = createLucideIcon({
  name: 'powder',
  node: [
    ['path', { d: 'M3 20h18', key: 'ground' }],
    ['path', { d: 'M5 20a7 6 0 0 1 14 0', key: 'heap' }],
    ['path', { d: 'M12 4v2.5', key: 'kernel-middle' }],
    ['path', { d: 'M8.5 6.5l.8 2', key: 'kernel-left' }],
    ['path', { d: 'M15.5 6.5l-.8 2', key: 'kernel-right' }],
  ],
})
