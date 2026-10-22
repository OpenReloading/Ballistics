'use client'

import { usePathname } from 'next/navigation'
import { routeOf } from '../lib/sections.ts'

/** `usePathname` as a route, `/workbench` in both editions: route sets and comparisons take it. */
export const useRoute = () => routeOf(usePathname())
