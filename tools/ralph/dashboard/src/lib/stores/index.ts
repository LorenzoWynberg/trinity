/**
 * Zustand stores for client-side state management
 *
 * Usage:
 *   import { useSettingsStore, usePrdStore, useRunStore } from '@/lib/stores'
 *
 *   // In a component
 *   const { theme, setTheme } = useSettingsStore()
 *   const { prd, loadPrd } = usePrdStore()
 *   const { state, start, stop } = useRunStore()
 */

export { useSettingsStore, type Settings, type Theme, type GraphDirection } from './settings'
export { usePrdStore } from './prd'
export { useRunStore } from './run'
