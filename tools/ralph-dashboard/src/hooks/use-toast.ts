'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
  action?: ReactNode
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    // Return a no-op if used outside provider (for SSR)
    return {
      toast: () => {},
      toasts: [],
      dismiss: () => {}
    }
  }
  return context
}

export { ToastContext }
