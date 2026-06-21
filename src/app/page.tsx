'use client'

import { useAdminStore, type AdminSection } from '@/stores/admin-store'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  Database,
  GitBranch,
  Globe,
  Shield,
  HardDrive,
  Code2,
  Activity,
  Brain,
  FileText,
  Search,
  Command,
  Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

import { DashboardView } from '@/components/admin/dashboard'
import { TablesView } from '@/components/admin/tables'
import { PipelineView } from '@/components/admin/pipeline'
import { ScraperView } from '@/components/admin/scraper'
import { AuthView } from '@/components/admin/auth'
import { StorageView } from '@/components/admin/storage'
import { FunctionsView } from '@/components/admin/functions'
import { MonitoringView } from '@/components/admin/monitoring'
import { AiView } from '@/components/admin/ai'
import { LogsView } from '@/components/admin/logs'
import { SettingsView } from '@/components/admin/settings'
import { RealtimeIndicator } from '@/components/admin/realtime-indicator'
import { NotificationsBell } from '@/components/admin/notifications-bell'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems: { section: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'tables', label: 'Tables', icon: Database },
  { section: 'pipeline', label: 'Pipeline Studio', icon: GitBranch },
  { section: 'scraper', label: 'Web Scraper', icon: Globe },
  { section: 'auth', label: 'Auth', icon: Shield },
  { section: 'storage', label: 'Storage', icon: HardDrive },
  { section: 'functions', label: 'Functions', icon: Code2 },
  { section: 'monitoring', label: 'Monitoring', icon: Activity },
  { section: 'ai', label: 'AI', icon: Brain },
  { section: 'logs', label: 'Logs', icon: FileText },
  { section: 'settings', label: 'Settings', icon: Settings },
]

function SectionContent({ section }: { section: AdminSection }) {
  switch (section) {
    case 'dashboard': return <DashboardView />
    case 'tables': return <TablesView />
    case 'pipeline': return <PipelineView />
    case 'scraper': return <ScraperView />
    case 'auth': return <AuthView />
    case 'storage': return <StorageView />
    case 'functions': return <FunctionsView />
    case 'monitoring': return <MonitoringView />
    case 'ai': return <AiView />
    case 'logs': return <LogsView />
    case 'settings': return <SettingsView />
    default: return <DashboardView />
  }
}

export default function AdminStudio() {
  const { activeSection, setActiveSection } = useAdminStore()
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <SidebarProvider>
      {/* Sidebar */}
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-sm">
              SB
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-bold text-sidebar-foreground">SelfBase</div>
              <div className="text-[10px] text-sidebar-foreground/50">Admin Studio</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {/* Search */}
          <SidebarGroup className="px-2">
            <SidebarGroupContent>
              <button
                onClick={() => setCommandOpen(true)}
                className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="group-data-[collapsible=icon]:hidden">Search...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-sidebar-border px-1.5 font-mono text-[10px] font-medium text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                  ⌘K
                </kbd>
              </button>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-400 text-[10px] uppercase tracking-wider">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.section}>
                    <SidebarMenuButton
                      isActive={activeSection === item.section}
                      onClick={() => setActiveSection(item.section)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="rounded-md bg-sidebar-accent px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-sidebar-foreground/80">Server Online</span>
              </div>
              <div className="mt-1 text-[10px] text-sidebar-foreground/50">SelfBase v1.0 · Local-First</div>
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Main Content */}
      <SidebarInset>
        <div className="flex min-h-svh flex-col">
          {/* Top Bar */}
          <header className="flex h-12 items-center gap-3 border-b bg-background border-border px-4 shrink-0">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-5" />
            <NotificationsBell />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize text-emerald-600 border-emerald-200 bg-emerald-50">
                {navItems.find((n) => n.section === activeSection)?.label ?? 'Dashboard'}
              </Badge>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <RealtimeIndicator />
              <ThemeToggle />
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setCommandOpen(true)}>
                <Command className="h-3 w-3" />
                <span className="hidden sm:inline">Command</span>
                <kbd className="hidden sm:inline-flex h-4 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="p-4 md:p-6 lg:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <SectionContent section={activeSection} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t bg-background border-border px-4 py-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>SelfBase v1.0 · Self-Hosted · Local-First</span>
              <span className="hidden sm:inline">AI-Native Backend-as-a-Service</span>
            </div>
          </footer>
        </div>
      </SidebarInset>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search sections, tables, functions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.section}
                onSelect={() => { setActiveSection(item.section); setCommandOpen(false) }}
                className="gap-2"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => { setActiveSection('tables'); setCommandOpen(false) }}>
              <Database className="mr-2 h-4 w-4" />Create New Table
            </CommandItem>
            <CommandItem onSelect={() => { setActiveSection('pipeline'); setCommandOpen(false) }}>
              <GitBranch className="mr-2 h-4 w-4" />New Pipeline Source
            </CommandItem>
            <CommandItem onSelect={() => { setActiveSection('functions'); setCommandOpen(false) }}>
              <Code2 className="mr-2 h-4 w-4" />Deploy Function
            </CommandItem>
            <CommandItem onSelect={() => { setActiveSection('ai'); setCommandOpen(false) }}>
              <Brain className="mr-2 h-4 w-4" />Open RAG Chat
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  )
}
