'use client'

import { BulletIcon, CartridgeIcon, PowderIcon, RifleIcon } from '@rangefoundry/ui'
import {
  ChartColumn,
  Database,
  Download,
  FlaskConical,
  Info,
  type LucideIcon,
  Search,
  Settings,
  Target,
  TriangleExclamationPoint,
} from 'lucide-react'

/** Lucide icons (ISC, https://lucide.dev); a cartridge, a bullet, a rifle and powder are `ui`'s own on Lucide's grid. */
const icons: Record<string, LucideIcon> = {
  // the Library page: the Database
  database: Database,
  '/cartridges': CartridgeIcon,
  '/bullets': BulletIcon,
  '/firearms': RifleIcon,
  '/powders': PowderIcon,
  '/workbench': FlaskConical,
  '/session': ChartColumn,
  '/groups': Target,
  settings: Settings,
  search: Search,
  safety: TriangleExclamationPoint,
  install: Download,
}

export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Glyph = icons[name] ?? Info
  return <Glyph size={size} aria-hidden="true" focusable="false" />
}
