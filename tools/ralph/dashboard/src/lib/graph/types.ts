export type GraphLayoutData = {
  active: string // 'horizontal' | 'vertical' | custom layout name
  defaultLayout: string // default layout to use when loading this version
  customLayouts: Record<string, { positions: Record<string, { x: number; y: number }> }>
}

export type LayoutDirection = 'horizontal' | 'horizontal-compact' | 'vertical' | 'vertical-compact'

export const defaultLayoutData: GraphLayoutData = {
  active: 'horizontal',
  defaultLayout: 'horizontal',
  customLayouts: {}
}
