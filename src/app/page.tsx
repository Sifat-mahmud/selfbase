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
  Terminal,
  Loader2,
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
import { useEffect, useRef, useState } from 'react'

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
import { PlaygroundView } from '@/components/admin/playground'
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
  { section: 'playground' as AdminSection, label: 'API Playground', icon: Terminal },
  { section: 'settings', label: 'Settings', icon: Settings },
]

// Normalizes API responses that may be either a raw array or { data: [...] }
function normalize(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  return []
}

interface SearchResults {
  tables: Array<{ id: string; name: string; displayName?: string }>
  pipelines: Array<{ id: string; name: string; url: string }>
  functions: Array<{ id: string; name: string; description?: string }>
  scrapers: Array<{ id: string; name: string; url: string }>
  files: Array<{ id: string; filename: string; bucket: string }>
  users: Array<{ id: string; email: string; name?: string }>
}

const EMPTY_SEARCH_RESULTS: SearchResults = {
  tables: [],
  pipelines: [],
  functions: [],
  scrapers: [],
  files: [],
  users: [],
}

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
    case 'playground': return <PlaygroundView />
    case 'settings': return <SettingsView />
    default: return <DashboardView />
  }
}

export default function AdminStudio() {
  const { activeSection, setActiveSection } = useAdminStore()
  const [commandOpen, setCommandOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_SEARCH_RESULTS)
  const [dataLoaded, setDataLoaded] = useState(false)
  // Ref guard prevents duplicate in-flight fetches when the palette reopens quickly
  const fetchInFlight = useRef(false)
  // Derived loading state — no synchronous setState in effect body needed
  const dataLoading = commandOpen && !dataLoaded

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

  // Fetch data from all major APIs when the command palette opens (cached via dataLoaded)
  useEffect(() => {
    if (!commandOpen || dataLoaded || fetchInFlight.current) return
    fetchInFlight.current = true
    let cancelled = false
    Promise.all([
      fetch('/api/tables').then((r) => r.json()).catch(() => []),
      fetch('/api/pipelines').then((r) => r.json()).catch(() => []),
      fetch('/api/functions').then((r) => r.json()).catch(() => []),
      fetch('/api/scrapers').then((r) => r.json()).catch(() => []),
      fetch('/api/storage').then((r) => r.json()).catch(() => []),
      fetch('/api/auth/users').then((r) => r.json()).catch(() => []),
    ])
      .then(([tables, pipelines, functions, scrapers, files, users]) => {
        if (cancelled) return
        setSearchResults({
          tables: normalize(tables).map((t: any) => ({
            id: String(t.id),
            name: String(t.name ?? ''),
            displayName: t.displayName ?? undefined,
          })),
          pipelines: normalize(pipelines).map((p: any) => ({
            id: String(p.id),
            name: String(p.name ?? ''),
            url: String(p.url ?? ''),
          })),
          functions: normalize(functions).map((f: any) => ({
            id: String(f.id),
            name: String(f.name ?? ''),
            description: f.description ?? undefined,
          })),
          scrapers: normalize(scrapers).map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? ''),
            url: String(s.startUrl ?? s.url ?? ''),
          })),
          files: normalize(files).map((f: any) => ({
            id: String(f.id),
            filename: String(f.originalName ?? f.name ?? ''),
            bucket: String(f.bucket ?? 'default'),
          })),
          users: normalize(users).map((u: any) => ({
            id: String(u.id),
            email: String(u.email ?? ''),
            name: u.name ?? undefined,
          })),
        })
        setDataLoaded(true)
        fetchInFlight.current = false
      })
      .catch(() => {
        fetchInFlight.current = false
      })
    return () => {
      cancelled = true
      fetchInFlight.current = false
    }
  }, [commandOpen, dataLoaded])

  // Reset the cache 30s after the palette closes so reopened data is fresh-ish
  useEffect(() => {
    if (commandOpen) return
    const timer = setTimeout(() => setDataLoaded(false), 30000)
    return () => clearTimeout(timer)
  }, [commandOpen])

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
        <CommandInput placeholder="Search sections, tables, pipelines, functions, files, users..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Loading state */}
          {dataLoading && !dataLoaded && (
            <CommandGroup heading="Loading">
              <CommandItem disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Loading data...</span>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Dynamic: Tables */}
          {dataLoaded && searchResults.tables.length > 0 && (
            <CommandGroup heading="Tables">
              {searchResults.tables.map((table) => (
                <CommandItem
                  key={table.id}
                  onSelect={() => { setActiveSection('tables'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <Database className="h-4 w-4 text-emerald-600" />
                  <span>{table.displayName || table.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-mono truncate max-w-[180px]">{table.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic: Pipelines */}
          {dataLoaded && searchResults.pipelines.length > 0 && (
            <CommandGroup heading="Pipelines">
              {searchResults.pipelines.map((pipeline) => (
                <CommandItem
                  key={pipeline.id}
                  onSelect={() => { setActiveSection('pipeline'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <GitBranch className="h-4 w-4 text-teal-600" />
                  <span>{pipeline.name}</span>
                  {pipeline.url && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{pipeline.url}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic: Functions */}
          {dataLoaded && searchResults.functions.length > 0 && (
            <CommandGroup heading="Functions">
              {searchResults.functions.map((fn) => (
                <CommandItem
                  key={fn.id}
                  onSelect={() => { setActiveSection('functions'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <Code2 className="h-4 w-4 text-purple-600" />
                  <span>{fn.name}</span>
                  {fn.description && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{fn.description}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic: Scrapers */}
          {dataLoaded && searchResults.scrapers.length > 0 && (
            <CommandGroup heading="Scrapers">
              {searchResults.scrapers.map((scraper) => (
                <CommandItem
                  key={scraper.id}
                  onSelect={() => { setActiveSection('scraper'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <Globe className="h-4 w-4 text-amber-600" />
                  <span>{scraper.name}</span>
                  {scraper.url && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{scraper.url}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic: Storage Files */}
          {dataLoaded && searchResults.files.length > 0 && (
            <CommandGroup heading="Storage Files">
              {searchResults.files.map((file) => (
                <CommandItem
                  key={file.id}
                  onSelect={() => { setActiveSection('storage'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <HardDrive className="h-4 w-4 text-blue-600" />
                  <span className="truncate">{file.filename}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{file.bucket}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Dynamic: Users */}
          {dataLoaded && searchResults.users.length > 0 && (
            <CommandGroup heading="Users">
              {searchResults.users.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => { setActiveSection('auth'); setCommandOpen(false) }}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4 text-rose-600" />
                  <span>{user.email}</span>
                  {user.name && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{user.name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Static: Navigation */}
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
