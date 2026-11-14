'use client'

import { usePathname } from '@/platform/navigation.ts'
import { routeOf } from '../lib/sections.ts'

/** `usePathname` as a route, `/workbench` with or without the trailing slash: route sets and comparisons take it. */
export const useRoute = () => routeOf(usePathname())
