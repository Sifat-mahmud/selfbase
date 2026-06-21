import { create } from 'zustand'

export type AdminSection =
  | 'dashboard'
  | 'tables'
  | 'pipeline'
  | 'scraper'
  | 'auth'
  | 'storage'
  | 'functions'
  | 'monitoring'
  | 'ai'
  | 'logs'
  | 'playground'
  | 'settings'

interface AdminState {
  activeSection: AdminSection
  setActiveSection: (section: AdminSection) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
}

export const useAdminStore = create<AdminState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
}))
