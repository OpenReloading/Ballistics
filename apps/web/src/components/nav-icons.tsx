'use client'

import {
  BookOpenText,
  ChartBar,
  DownloadSimple,
  Flask,
  Gear,
  Grains,
  type Icon,
  Info,
  MagnifyingGlass,
  Target,
  Warning,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/**
 * Phosphor icons (MIT, https://phosphoricons.com), the set Mantine recommends. No icon set
 * of that list draws a cartridge, a bullet or a rifle, so those three are drawn for the project in the same
 * stroke style.
 */
const icons: Record<string, Icon> = {
  '/powders': Grains,
  '/workbench': Flask,
  '/session': ChartBar,
  '/groups': Target,
  // the rule books that define the disciplines
  '/disciplines': BookOpenText,
  settings: Gear,
  search: MagnifyingGlass,
  safety: Warning,
  install: DownloadSimple,
}

const drawn: Record<string, ReactNode> = {
  // lying, rim, case, shoulder and the seated bullet's nose
  '/cartridges': (
    <path d="M3 8.5v7M4.5 9H12l2 1.5h1.5c2.5 0 4.5.6 5.5 1.5-1 .9-3 1.5-5.5 1.5H14L12 15H4.5zM14 10.5v3" />
  ),
  // standing, its ogive up and a cannelure
  '/bullets': <path d="M8.5 21V11c0-3.5 1.6-6.5 3.5-8 1.9 1.5 3.5 4.5 3.5 8v10zM8.5 17h7" />,
  // a rifle with its scope: the crosshair glyph would echo the groups' target
  '/firearms': <path d="M2 11l6-.5.5-.5H22v1.5H12L11 13H9l-1.5 2.5H3.5zM9.5 7h5v2h-5z" />,
  // a ring face with its black: the arrowed target is the shot groups'
  '/targets': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" style={{ fill: 'currentColor' }} />
    </>
  ),
}

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  if (drawn[name])
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="nav-icon"
      >
        {drawn[name]}
      </svg>
    )
  const Glyph = icons[name] ?? Info
  return <Glyph size={size} aria-hidden="true" focusable="false" />
}
