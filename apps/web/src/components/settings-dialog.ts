import { createContext } from 'react'

/** The tabs of the settings dialog. */
export type SettingsTab = 'units' | 'defaults' | 'manufacturers' | 'appearance' | 'offline'

/** Opens the settings dialog over the current page (`Providers`) on a tab, Units when none is given; Settings has no page of its own. */
export const SettingsDialog = createContext<(tab?: SettingsTab) => void>(() => {})
